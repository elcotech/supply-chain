from __future__ import annotations

import argparse
import base64
import html
import json
import re
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


def slug(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).lower()).strip("_")


def find_column(frame: pd.DataFrame, *names: str) -> str | None:
    lookup = {slug(column): column for column in frame.columns}
    for name in names:
        column = lookup.get(slug(name))
        if column is not None:
            return column
    return None


def read_csv(path: str | None) -> pd.DataFrame:
    if not path:
        return pd.DataFrame()
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(f"CSV file not found: {source}")
    return pd.read_csv(source)


def load_json_export(path: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Read the JSON exported by the app's Analytics page."""
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("The JSON export must be an object with orders/products/companies arrays")
    orders = pd.DataFrame(payload.get("orders") or [])
    products = pd.DataFrame(payload.get("products") or payload.get("materials") or [])
    companies = pd.DataFrame(payload.get("companies") or [])

    # App records reference suppliers and products by id. Resolve the ids to
    # names so the very same charts work for both CSV and JSON exports.
    if not orders.empty:
        names: dict[str, str] = {}
        cities: dict[str, str] = {}
        if not companies.empty and "id" in companies.columns:
            name_column = find_column(companies, "name", "companyName", "company_name")
            city_column = find_column(companies, "city", "City")
            for _, row in companies.iterrows():
                key = str(row["id"])
                if name_column:
                    names[key] = str(row[name_column])
                if city_column:
                    cities[key] = str(row[city_column])
        if not products.empty and "id" in products.columns:
            name_column = find_column(products, "name", "materialName", "product_name")
            if name_column:
                for _, row in products.iterrows():
                    names[str(row["id"])] = str(row[name_column])

        supplier_column = find_column(orders, "supplier", "supplier_name", "company", "company_name")
        if not supplier_column and "companyId" in orders.columns:
            orders["supplier"] = orders["companyId"].astype(str).map(names).fillna("Unknown supplier")
        product_column = find_column(orders, "product", "material", "material_name", "product_name")
        if not product_column and "materialId" in orders.columns:
            orders["product"] = orders["materialId"].astype(str).map(names).fillna("Unknown product")
        if "city" not in {slug(column) for column in orders.columns} and "companyId" in orders.columns:
            orders["city"] = orders["companyId"].astype(str).map(cities).fillna("Unknown")
        payment_column = find_column(orders, "paymentStatus", "payment_status", "payment", "paymentMethod")
        if not payment_column and "paymentStatus" in orders.columns:
            orders["payment"] = orders["paymentStatus"].astype(str)
    return orders, products, companies


def to_number(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.replace(",", "", regex=False).str.replace(r"[^0-9.\-]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce").fillna(0)


def month_end_alias() -> str:
    try:
        pd.tseries.frequencies.to_offset("ME")
        return "ME"
    except Exception:
        return "M"


def save_bar(values: pd.Series, title: str, xlabel: str, ylabel: str, path: Path, horizontal: bool = False) -> bool:
    if values.empty:
        return False
    figure, axis = plt.subplots(figsize=(10, 5.5))
    color = "#0b2f52" if horizontal else "#c9a227"
    if horizontal:
        values.sort_values().plot(kind="barh", ax=axis, color=color)
        axis.set_xlabel(xlabel)
        axis.set_ylabel(ylabel)
        axis.grid(axis="x", alpha=0.25)
    else:
        values.plot(kind="bar", ax=axis, color=color)
        axis.set_xlabel(xlabel)
        axis.set_ylabel(ylabel)
        axis.grid(axis="y", alpha=0.25)
        plt.setp(axis.get_xticklabels(), rotation=45, ha="right")
    axis.set_title(title)
    figure.tight_layout()
    figure.savefig(path, dpi=160)
    plt.close(figure)
    return True


def save_line(values: pd.Series, title: str, xlabel: str, ylabel: str, path: Path) -> bool:
    if values.empty:
        return False
    labels = [item.strftime("%Y-%m") if hasattr(item, "strftime") else str(item) for item in values.index]
    figure, axis = plt.subplots(figsize=(10, 5))
    axis.plot(labels, values.values, marker="o", linewidth=2, color="#0b2f52")
    axis.set_title(title)
    axis.set_xlabel(xlabel)
    axis.set_ylabel(ylabel)
    axis.grid(alpha=0.25)
    plt.setp(axis.get_xticklabels(), rotation=45, ha="right")
    figure.tight_layout()
    figure.savefig(path, dpi=160)
    plt.close(figure)
    return True


def build_html(summary: list[str], charts: list[dict[str, str]], title: str) -> str:
    """Embed every PNG into one portable page that works inside the APK."""
    stats = "".join(
        f'<div class="stat"><span>{html.escape(line.split(":", 1)[0])}</span>'
        f'<strong>{html.escape(line.split(":", 1)[-1].strip())}</strong></div>'
        for line in summary
        if ":" in line
    )
    cards: list[str] = []
    for chart in charts:
        path = Path(chart["path"])
        if not path.exists():
            continue
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        cards.append(
            '<article class="card">'
            f'<h2>{html.escape(chart["title"])}</h2>'
            f'<p>{html.escape(chart["description"])}</p>'
            f'<img src="data:image/png;base64,{encoded}" alt="{html.escape(chart["title"])}">'
            '</article>'
        )
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ margin: 0; background: #eef4fa; color: #12314f; font: 15px/1.5 Segoe UI, Arial, sans-serif; }}
  header {{ background: #0b2f52; color: #fff; padding: 32px 20px; text-align: center; }}
  header span {{ color: #f2c75c; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }}
  header h1 {{ margin: 8px 0 4px; font-size: 28px; }}
  main {{ max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }}
  .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }}
  .stat {{ background: #fff; border: 1px solid #d7e5f2; border-radius: 12px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(11,47,82,.06); }}
  .stat span {{ display: block; color: #6d89a6; font-size: 12px; }}
  .stat strong {{ font-size: 20px; color: #0b2f52; }}
  .card {{ background: #fff; border: 1px solid #d7e5f2; border-radius: 12px; padding: 18px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(11,47,82,.06); }}
  .card h2 {{ margin: 0 0 4px; font-size: 18px; }}
  .card p {{ margin: 0 0 12px; color: #6d89a6; font-size: 13px; }}
  .card img {{ display: block; width: 100%; height: auto; border-radius: 8px; }}
  footer {{ text-align: center; padding: 20px; color: #6d89a6; font-size: 12px; }}
</style>
</head>
<body>
<header><span>E-SCON - Python analytics</span><h1>{html.escape(title)}</h1><p>Generated {generated} with pandas and matplotlib</p></header>
<main><section class="stats">{stats}</section>{''.join(cards)}</main>
<footer>Charts generated by analytics/analyze.py - export JSON from the Analytics page to refresh this report</footer>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse E-SCON exports and save Python charts as PNG images and an HTML report.")
    parser.add_argument("--orders", help="Orders CSV exported from E-SCON")
    parser.add_argument("--products", help="Products CSV exported from E-SCON")
    parser.add_argument("--companies", help="Suppliers CSV exported from E-SCON")
    parser.add_argument("--data", help="JSON data exported from the Analytics page (orders/products/companies)")
    parser.add_argument("--output", default="analytics_charts", help="Folder for generated PNG charts")
    parser.add_argument("--html", help="Optional path for a self-contained HTML report with embedded charts")
    parser.add_argument("--title", default="E-SCON business analytics", help="Report title")
    args = parser.parse_args()

    if not args.data and not args.orders:
        parser.error("provide --data (JSON export) or --orders (CSV export)")

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    charts: list[dict[str, str]] = []

    def add_chart(filename: str, title: str, description: str, made: bool) -> None:
        if made:
            charts.append({
                "title": title,
                "description": description,
                "path": str(output / filename),
            })

    if args.data:
        orders, products, companies = load_json_export(args.data)
    else:
        orders, products, companies = read_csv(args.orders), read_csv(args.products), read_csv(args.companies)

    summary = [f"Orders analysed: {len(orders)}"]

    if not orders.empty:
        amount_column = find_column(
            orders, "total_vat_transport", "total_amount", "totalAmount", "totalETB", "TotalETB",
            "total", "Total (VAT + transport)", "Total"
        )
        date_column = find_column(orders, "date", "order_date", "orderDate", "orderdate")
        status_column = find_column(orders, "status", "order_status", "orderStatus")
        supplier_column = find_column(orders, "supplier", "supplier_name", "company", "company_name")
        product_column = find_column(orders, "product", "material", "material_name", "product_name")
        city_column = find_column(orders, "city", "City")
        payment_column = find_column(orders, "paymentStatus", "payment_status", "payment", "paymentMethod")
        quantity_column = find_column(orders, "quantity", "Quantity")
        orders["_amount"] = to_number(orders[amount_column]) if amount_column else 0
        summary.append(f"Order value: {orders['_amount'].sum():,.2f} ETB")

        if date_column:
            orders["_date"] = pd.to_datetime(orders[date_column], errors="coerce")
            dated = orders.dropna(subset=["_date"])
            if not dated.empty:
                month_end = month_end_alias()
                monthly_value = dated.set_index("_date").resample(month_end)["_amount"].sum()
                monthly_count = dated.set_index("_date").resample(month_end).size()
                add_chart("revenue_by_month.png", "Order value by month", "ETB of order value closed in each month.",
                          save_line(monthly_value, "Order value by month", "Month", "Value (ETB)", output / "revenue_by_month.png"))
                add_chart("orders_by_month.png", "Orders by month", "Number of order lines created each month.",
                          save_line(monthly_count, "Orders by month", "Month", "Orders", output / "orders_by_month.png"))

        if status_column:
            counts = orders[status_column].fillna("Unknown").astype(str).value_counts().head(10)
            add_chart("orders_by_status.png", "Orders by status", "Order lines grouped by their commercial status.",
                      save_bar(counts, "Orders by status", "Status", "Orders", output / "orders_by_status.png"))

        if payment_column:
            counts = orders[payment_column].fillna("Unknown").astype(str).value_counts().head(10)
            add_chart("orders_by_payment.png", "Orders by payment status", "How buyers settled their orders.",
                      save_bar(counts, "Orders by payment status", "Payment", "Orders", output / "orders_by_payment.png"))

        if supplier_column and amount_column:
            by_supplier = orders.groupby(supplier_column)["_amount"].sum().sort_values(ascending=False).head(10)
            add_chart("top_suppliers_by_value.png", "Top suppliers by order value", "Highest ETB totals per supplier.",
                      save_bar(by_supplier, "Top suppliers by order value", "Value (ETB)", "Supplier",
                               output / "top_suppliers_by_value.png", horizontal=True))

        if product_column and amount_column:
            by_product = orders.groupby(product_column)["_amount"].sum().sort_values(ascending=False).head(10)
            add_chart("top_products_by_value.png", "Top products by order value", "Best-selling products in ETB.",
                      save_bar(by_product, "Top products by order value", "Value (ETB)", "Product",
                               output / "top_products_by_value.png", horizontal=True))
            if quantity_column:
                units = orders.groupby(product_column)[quantity_column].apply(lambda values: to_number(values).sum())
                units = units.sort_values(ascending=False).head(10)
                add_chart("top_products_by_units.png", "Top products by units sold", "Units ordered per product.",
                          save_bar(units, "Top products by units sold", "Units", "Product",
                                   output / "top_products_by_units.png", horizontal=True))

        if city_column and amount_column:
            by_city = orders.groupby(city_column)["_amount"].sum().sort_values(ascending=False).head(10)
            add_chart("order_value_by_city.png", "Order value by city", "Where buyer demand comes from.",
                      save_bar(by_city, "Order value by city", "Value (ETB)", "City",
                               output / "order_value_by_city.png", horizontal=True))

    if not products.empty:
        price_column = find_column(products, "price", "unit_price", "Unit Price (before VAT)", "selling_price")
        category_column = find_column(products, "category", "Category")
        summary.append(f"Products analysed: {len(products)}")
        if category_column:
            counts = products[category_column].fillna("Uncategorised").astype(str).value_counts().head(10)
            add_chart("products_by_category.png", "Products by category", "Number of listed products per category.",
                      save_bar(counts, "Products by category", "Category", "Products", output / "products_by_category.png"))
            if price_column:
                products["_price"] = to_number(products[price_column])
                average = products.groupby(category_column)["_price"].mean().sort_values(ascending=False).head(10)
                add_chart("average_price_by_category.png", "Average price by category", "Mean catalogue price in ETB.",
                          save_bar(average, "Average price by category", "Category", "Average price (ETB)",
                                   output / "average_price_by_category.png"))

    if not companies.empty:
        city_column = find_column(companies, "city", "City", "Place")
        summary.append(f"Suppliers analysed: {len(companies)}")
        if city_column:
            counts = companies[city_column].fillna("Unknown").astype(str).value_counts().head(10)
            add_chart("suppliers_by_city.png", "Suppliers by city", "Verified supplier coverage by city.",
                      save_bar(counts, "Suppliers by city", "Suppliers", "City", output / "suppliers_by_city.png", horizontal=True))

    saved = [chart for chart in charts if Path(chart["path"]).exists()]
    summary.append(f"Charts saved: {len(saved)}")
    summary.append(f"Output folder: {output.resolve()}")

    if args.html:
        report = Path(args.html)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(build_html(summary, saved, args.title), encoding="utf-8")

    print("E-SCON data analysis")
    for line in summary:
        print(line)
    if args.html:
        print(f"HTML report: {Path(args.html).resolve()}")


if __name__ == "__main__":
    main()
