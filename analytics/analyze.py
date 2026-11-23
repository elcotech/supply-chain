from __future__ import annotations

import argparse
import re
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


def to_number(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.replace(",", "", regex=False).str.replace(r"[^0-9.\-]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce").fillna(0)


def month_end_alias() -> str:
    try:
        pd.tseries.frequencies.to_offset("ME")
        return "ME"
    except Exception:
        return "M"


def save_bar(values: pd.Series, title: str, xlabel: str, ylabel: str, path: Path, horizontal: bool = False) -> None:
    if values.empty:
        return
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


def save_line(values: pd.Series, title: str, xlabel: str, ylabel: str, path: Path) -> None:
    if values.empty:
        return
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse E-SCON CSV exports and save charts as PNG images.")
    parser.add_argument("--orders", required=True, help="Orders CSV exported from E-SCON")
    parser.add_argument("--products", help="Products CSV exported from E-SCON")
    parser.add_argument("--companies", help="Suppliers CSV exported from E-SCON")
    parser.add_argument("--output", default="analytics_charts", help="Folder for generated charts")
    args = parser.parse_args()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    charts: list[Path] = []

    orders = read_csv(args.orders)
    summary = [f"Orders analysed: {len(orders)}"]

    if not orders.empty:
        amount_column = find_column(orders, "total_vat_transport", "total_amount", "total", "Total (VAT + transport)", "Total")
        date_column = find_column(orders, "date", "order_date", "orderdate")
        status_column = find_column(orders, "status", "order_status")
        supplier_column = find_column(orders, "supplier", "supplier_name", "company", "company_name")
        orders["_amount"] = to_number(orders[amount_column]) if amount_column else 0
        summary.append(f"Order value: {orders['_amount'].sum():,.2f} ETB")

        if date_column:
            orders["_date"] = pd.to_datetime(orders[date_column], errors="coerce")
            dated = orders.dropna(subset=["_date"])
            if not dated.empty:
                month_end = month_end_alias()
                monthly_value = dated.set_index("_date").resample(month_end)["_amount"].sum()
                monthly_count = dated.set_index("_date").resample(month_end).size()
                path = output / "revenue_by_month.png"
                save_line(monthly_value, "Order value by month", "Month", "Value (ETB)", path)
                charts.append(path)
                path = output / "orders_by_month.png"
                save_line(monthly_count, "Orders by month", "Month", "Orders", path)
                charts.append(path)

        if status_column:
            counts = orders[status_column].fillna("Unknown").astype(str).value_counts().head(10)
            path = output / "orders_by_status.png"
            save_bar(counts, "Orders by status", "Status", "Orders", path)
            charts.append(path)

        if supplier_column and amount_column:
            by_supplier = orders.groupby(supplier_column)["_amount"].sum().sort_values(ascending=False).head(10)
            path = output / "top_suppliers_by_value.png"
            save_bar(by_supplier, "Top suppliers by order value", "Value (ETB)", "Supplier", path, horizontal=True)
            charts.append(path)

    products = read_csv(args.products)
    if not products.empty:
        price_column = find_column(products, "price", "unit_price", "Unit Price (before VAT)", "selling_price")
        category_column = find_column(products, "category", "Category")
        summary.append(f"Products analysed: {len(products)}")
        if category_column:
            counts = products[category_column].fillna("Uncategorised").astype(str).value_counts().head(10)
            path = output / "products_by_category.png"
            save_bar(counts, "Products by category", "Category", "Products", path)
            charts.append(path)
            if price_column:
                products["_price"] = to_number(products[price_column])
                average = products.groupby(category_column)["_price"].mean().sort_values(ascending=False).head(10)
                path = output / "average_price_by_category.png"
                save_bar(average, "Average price by category", "Category", "Average price (ETB)", path)
                charts.append(path)

    companies = read_csv(args.companies)
    if not companies.empty:
        city_column = find_column(companies, "city", "City", "Place")
        summary.append(f"Suppliers analysed: {len(companies)}")
        if city_column:
            counts = companies[city_column].fillna("Unknown").astype(str).value_counts().head(10)
            path = output / "suppliers_by_city.png"
            save_bar(counts, "Suppliers by city", "Suppliers", "City", path, horizontal=True)
            charts.append(path)

    print("E-SCON data analysis")
    for line in summary:
        print(line)
    print(f"Charts saved: {len([path for path in charts if path.exists()])}")
    print(f"Output folder: {output.resolve()}")


if __name__ == "__main__":
    main()
