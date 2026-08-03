"""Deterministic public-market Universe Engine."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol

from app.schemas.universe import UniverseCandidate, UniverseRejection, UniverseSnapshot


class UniversePublicClient(Protocol):
    """Public methods required by the Universe Engine."""

    async def exchange_info(self) -> dict[str, Any]: ...

    async def ticker_24h_all(self) -> list[dict[str, Any]]: ...

    async def book_tickers(self) -> list[dict[str, Any]]: ...


@dataclass(frozen=True)
class _EligibleRecord:
    symbol: str
    base_asset: str
    quote_volume: Decimal
    bid_price: Decimal
    ask_price: Decimal
    spread_bps: Decimal


def _decimal_or_none(value: Any) -> Decimal | None:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not result.is_finite():
        return None
    return result


def _index_by_symbol(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        symbol = row.get("symbol")
        if isinstance(symbol, str) and symbol:
            result[symbol] = row
    return result


class UniverseService:
    """Build a ranked and auditable universe from public Binance data."""

    def __init__(
        self,
        client: UniversePublicClient,
        *,
        max_symbols: int,
        min_quote_volume: Decimal,
        max_spread_bps: Decimal,
    ) -> None:
        self._client = client
        self._max_symbols = max_symbols
        self._min_quote_volume = min_quote_volume
        self._max_spread_bps = max_spread_bps

    async def build(self) -> UniverseSnapshot:
        exchange_info, ticker_rows, book_rows = await asyncio.gather(
            self._client.exchange_info(),
            self._client.ticker_24h_all(),
            self._client.book_tickers(),
        )
        raw_symbols = exchange_info.get("symbols")
        if not isinstance(raw_symbols, list):
            raise ValueError("Invalid exchange-info symbols payload")

        tickers = _index_by_symbol(ticker_rows)
        books = _index_by_symbol(book_rows)
        eligible: list[_EligibleRecord] = []
        rejections: list[UniverseRejection] = []
        seen_symbols: set[str] = set()

        for index, raw_symbol in enumerate(raw_symbols):
            if not isinstance(raw_symbol, dict):
                rejections.append(
                    UniverseRejection(
                        symbol=f"<unknown:{index}>",
                        code="invalid_symbol_metadata",
                        detail="Symbol metadata must be an object",
                    )
                )
                continue

            raw_name = raw_symbol.get("symbol")
            symbol = raw_name if isinstance(raw_name, str) and raw_name else f"<unknown:{index}>"
            if symbol in seen_symbols or symbol.startswith("<unknown:"):
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="invalid_symbol_metadata",
                        detail="Symbol name is missing or duplicated",
                    )
                )
                continue
            seen_symbols.add(symbol)

            quote_asset = raw_symbol.get("quoteAsset")
            if quote_asset != "USDT":
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="non_usdt_quote",
                        detail="Quote asset is not USDT",
                    )
                )
                continue

            if raw_symbol.get("contractType") != "PERPETUAL":
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="non_perpetual_contract",
                        detail="Contract type is not PERPETUAL",
                    )
                )
                continue

            if raw_symbol.get("status") != "TRADING":
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="not_trading",
                        detail="Exchange status is not TRADING",
                    )
                )
                continue

            base_asset = raw_symbol.get("baseAsset")
            if not isinstance(base_asset, str) or not base_asset:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="invalid_symbol_metadata",
                        detail="Base asset is missing",
                    )
                )
                continue

            ticker = tickers.get(symbol)
            if ticker is None:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="missing_ticker",
                        detail="24-hour ticker is unavailable",
                    )
                )
                continue

            quote_volume = _decimal_or_none(ticker.get("quoteVolume"))
            if quote_volume is None or quote_volume < 0:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="invalid_quote_volume",
                        detail="Quote volume is invalid",
                    )
                )
                continue
            if quote_volume < self._min_quote_volume:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="below_min_quote_volume",
                        detail=f"Quote volume is below {self._min_quote_volume}",
                    )
                )
                continue

            book = books.get(symbol)
            if book is None:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="missing_book_ticker",
                        detail="Best bid/ask snapshot is unavailable",
                    )
                )
                continue

            bid_price = _decimal_or_none(book.get("bidPrice"))
            ask_price = _decimal_or_none(book.get("askPrice"))
            if (
                bid_price is None
                or ask_price is None
                or bid_price <= 0
                or ask_price <= 0
                or ask_price < bid_price
            ):
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="invalid_book_ticker",
                        detail="Best bid/ask values are invalid",
                    )
                )
                continue

            midpoint = (bid_price + ask_price) / Decimal("2")
            spread_bps = ((ask_price - bid_price) / midpoint) * Decimal("10000")
            if spread_bps > self._max_spread_bps:
                rejections.append(
                    UniverseRejection(
                        symbol=symbol,
                        code="spread_too_wide",
                        detail=f"Spread exceeds {self._max_spread_bps} bps",
                    )
                )
                continue

            eligible.append(
                _EligibleRecord(
                    symbol=symbol,
                    base_asset=base_asset,
                    quote_volume=quote_volume,
                    bid_price=bid_price,
                    ask_price=ask_price,
                    spread_bps=spread_bps,
                )
            )

        ranked = sorted(
            eligible,
            key=lambda item: (-item.quote_volume, item.spread_bps, item.symbol),
        )
        selected = ranked[: self._max_symbols]
        for overflow in ranked[self._max_symbols :]:
            rejections.append(
                UniverseRejection(
                    symbol=overflow.symbol,
                    code="universe_limit",
                    detail=f"Rank is outside the maximum universe size of {self._max_symbols}",
                )
            )

        candidates = [
            UniverseCandidate(
                rank=rank,
                symbol=item.symbol,
                base_asset=item.base_asset,
                quote_volume=item.quote_volume,
                bid_price=item.bid_price,
                ask_price=item.ask_price,
                spread_bps=item.spread_bps,
            )
            for rank, item in enumerate(selected, start=1)
        ]
        ordered_rejections = sorted(rejections, key=lambda item: (item.symbol, item.code))
        return UniverseSnapshot(
            generated_at=datetime.now(UTC),
            max_symbols=self._max_symbols,
            min_quote_volume=self._min_quote_volume,
            max_spread_bps=self._max_spread_bps,
            eligible_count=len(candidates),
            rejected_count=len(ordered_rejections),
            candidates=candidates,
            rejections=ordered_rejections,
        )
