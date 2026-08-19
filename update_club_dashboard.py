#!/usr/bin/env python3
"""Rebuild the embedded dashboard dataset from a bot members CSV export."""

from __future__ import annotations

import argparse
import calendar
import csv
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import mean


EXPECTED_COLUMNS = {
    "USER_ID",
    "username",
    "name",
    "phone",
    "active",
    "plan",
    "end_date",
    "recurrent",
    "pay_count",
    "pay_1st",
}

RUSSIAN_MONTHS = (
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)


def clean(row: dict[str, str | None], key: str) -> str:
    return (row.get(key) or "").strip()


def parse_datetime(value: str, *, field: str, user_id: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(
            f"Invalid {field} value {value!r} for USER_ID {user_id!r}"
        ) from exc


def epoch_utc(value: datetime) -> int:
    """Match the dashboard's existing convention: source timestamps are UTC."""
    return calendar.timegm(value.timetuple())


def month_key(value: datetime) -> str:
    return value.strftime("%Y-%m")


def plan_counts(rows: list[dict[str, object]]) -> dict[str, int]:
    counts = Counter(str(row["pl"]) for row in rows)
    return dict(counts.most_common())


def safe_json(value: object) -> str:
    # Prevent member-provided text from ending the surrounding script element.
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def export_date(csv_path: Path) -> datetime:
    match = re.search(r"(20\d{2})-(\d{2})-(\d{2})", csv_path.name)
    if not match:
        raise ValueError(
            "The CSV filename must contain an export date in YYYY-MM-DD format"
        )
    return datetime.strptime(match.group(0), "%Y-%m-%d")


def load_paid_members(csv_path: Path) -> list[dict[str, object]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise ValueError("The CSV has no header row")
        missing = EXPECTED_COLUMNS.difference(reader.fieldnames)
        if missing:
            raise ValueError(f"The CSV is missing columns: {', '.join(sorted(missing))}")
        source_rows = list(reader)

    rows: list[dict[str, object]] = []
    seen_user_ids: set[str] = set()
    for source_row in source_rows:
        pay_count_raw = clean(source_row, "pay_count")
        first_raw = clean(source_row, "pay_1st")
        end_raw = clean(source_row, "end_date")

        # Trial-only registrations have all three fields empty and are not part
        # of the paid-member dashboard.
        if not (pay_count_raw and first_raw and end_raw):
            continue

        user_id = clean(source_row, "USER_ID")
        if not user_id:
            raise ValueError("A paid member is missing USER_ID")
        if user_id in seen_user_ids:
            raise ValueError(f"Duplicate paid-member USER_ID: {user_id}")
        seen_user_ids.add(user_id)

        try:
            pay_count = int(pay_count_raw)
        except ValueError as exc:
            raise ValueError(
                f"Invalid pay_count value {pay_count_raw!r} for USER_ID {user_id!r}"
            ) from exc
        if pay_count <= 0:
            raise ValueError(f"Non-positive pay_count for USER_ID {user_id!r}")

        first = parse_datetime(first_raw, field="pay_1st", user_id=user_id)
        end = parse_datetime(end_raw, field="end_date", user_id=user_id)
        username = clean(source_row, "username")
        rows.append(
            {
                "n": clean(source_row, "name"),
                "u": f"@{username}" if username else "",
                "p": clean(source_row, "phone"),
                "s": first.strftime("%d.%m.%Y"),
                "e": end.strftime("%d.%m.%Y"),
                "st": "active" if clean(source_row, "active") == "1" else "churned",
                "pl": clean(source_row, "plan"),
                "pc": pay_count,
                "lt": (end - first).days,
                "sk": epoch_utc(first),
                "ek": epoch_utc(end),
                "rec": clean(source_row, "recurrent"),
                "_first": first,
                "_end": end,
            }
        )

    if not rows:
        raise ValueError("The CSV contains no paid members")
    return rows


def build_dataset(csv_path: Path) -> dict[str, object]:
    internal_rows = load_paid_members(csv_path)
    active = [row for row in internal_rows if row["st"] == "active"]
    churned = [row for row in internal_rows if row["st"] == "churned"]

    join_counts = Counter(month_key(row["_first"]) for row in internal_rows)
    churn_counts = Counter(month_key(row["_end"]) for row in churned)
    months = sorted(set(join_counts) | set(churn_counts))

    # Preserve the source dashboard's compact integer convention for lifetime
    # averages and one-decimal convention for payment averages.
    stats = {
        "total": len(internal_rows),
        "active": len(active),
        "churned": len(churned),
        "retention": round(len(active) / len(internal_rows) * 100, 1),
        "avg_lt_a": int(mean(int(row["lt"]) for row in active)),
        "avg_lt_c": int(mean(int(row["lt"]) for row in churned)),
        "avg_pay_a": round(mean(int(row["pc"]) for row in active), 1),
        "avg_pay_c": round(mean(int(row["pc"]) for row in churned), 1),
        "rec": sum(row["rec"] == "+" for row in active),
        "plans_a": plan_counts(active),
        "plans_c": plan_counts(churned),
        "months": months,
        "joins": [join_counts[month] for month in months],
        "churn": [churn_counts[month] for month in months],
        "onepay_c": sum(int(row["pc"]) <= 1 for row in churned),
    }

    internal_rows.sort(
        key=lambda row: (
            0 if row["st"] == "churned" else 1,
            -int(row["ek"]) if row["st"] == "churned" else int(row["ek"]),
        )
    )
    rows = [
        {key: value for key, value in row.items() if not key.startswith("_")}
        for row in internal_rows
    ]
    return {"rows": rows, "stats": stats}


def update_html(source_html: str, dataset: dict[str, object], as_of: datetime) -> str:
    subtitle = (
        f'<div class="sub">Данные на {as_of.day} '
        f'{RUSSIAN_MONTHS[as_of.month]} {as_of.year} · актуальная выгрузка</div>'
    )
    updated, subtitle_count = re.subn(
        r'<div class="sub">.*?</div>', subtitle, source_html, count=1
    )
    if subtitle_count != 1:
        raise ValueError("Could not locate the dashboard subtitle")

    data_script = f"const D={safe_json(dataset)};const S=D.stats;"
    updated, data_count = re.subn(
        r"const D=.*?;const S=D\.stats;",
        lambda _match: data_script,
        updated,
        count=1,
        flags=re.DOTALL,
    )
    if data_count != 1:
        raise ValueError("Could not locate the embedded dashboard dataset")

    old_insight = (
        "document.getElementById('ins').innerHTML=`<b>Главное:</b> "
        "${S.onepay_c} из ${S.churned} отменивших "
        "(${Math.round(S.onepay_c/S.churned*100)}%) ушли, сделав один платёж или "
        "меньше — провал именно на первом месяце, а не в долгосроке. При этом активные "
        "живут в среднем ${S.avg_lt_a} дней против ${S.avg_lt_c} у ушедших. Все "
        "${S.churned} отменивших сидели на месячном тарифе или «Старте» — среди 6- и "
        "12-месячных отмен нет вообще.`;"
    )
    new_insight = (
        "const shortChurn=(S.plans_c['1 месяц 💬']||0)+(S.plans_c['Старт']||0);\n"
        "const longChurn=S.churned-shortChurn;\n"
        "document.getElementById('ins').innerHTML=`<b>Главное:</b> "
        "${S.onepay_c} из ${S.churned} отменивших "
        "(${Math.round(S.onepay_c/S.churned*100)}%) ушли, сделав один платёж или "
        "меньше — провал по-прежнему сосредоточен в начале участия. Активные живут "
        "в среднем ${S.avg_lt_a} дней против ${S.avg_lt_c} у ушедших. "
        "${shortChurn} отмен пришлись на месячный тариф или «Старт»"
        "${longChurn?`; ещё ${longChurn} — на более длинные тарифы`:''}.`;"
    )
    if old_insight in updated:
        updated = updated.replace(old_insight, new_insight, 1)
    elif new_insight not in updated:
        raise ValueError("Could not locate the dashboard insight text")

    # The CSV contains user-controlled display names. Escape cell values before
    # inserting them into table markup while retaining the dashboard's layout.
    render_anchor = "const tb=document.getElementById('tb'),q=document.getElementById('q');"
    safe_render_anchor = (
        "const tb=document.getElementById('tb'),q=document.getElementById('q');\n"
        "const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>"
        "({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));"
    )
    if "const esc=v=>" not in updated:
        if render_anchor not in updated:
            raise ValueError("Could not locate the table-render setup")
        updated = updated.replace(render_anchor, safe_render_anchor, 1)

        replacements = {
            "${x.n}": "${esc(x.n)}",
            "${x.u||'<span class=\"dim\">—</span>'}": (
                "${x.u?esc(x.u):'<span class=\"dim\">—</span>'}"
            ),
            "${x.p||'<span class=\"dim\">—</span>'}": (
                "${x.p?esc(x.p):'<span class=\"dim\">—</span>'}"
            ),
            "<td>${x.s}</td><td>${x.e}</td>": (
                "<td>${esc(x.s)}</td><td>${esc(x.e)}</td>"
            ),
        }
        for old, new in replacements.items():
            if old not in updated:
                raise ValueError(f"Could not locate table-render fragment: {old}")
            updated = updated.replace(old, new, 1)

    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    source_html = args.html.read_text(encoding="utf-8")
    dataset = build_dataset(args.csv)
    updated_html = update_html(source_html, dataset, export_date(args.csv))
    args.output.write_text(updated_html, encoding="utf-8")

    stats = dataset["stats"]
    print(
        "Updated dashboard: "
        f"{stats['total']} members, {stats['active']} active, "
        f"{stats['churned']} churned, {stats['retention']}% retention"
    )


if __name__ == "__main__":
    main()
