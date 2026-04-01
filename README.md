# Lead Lens

A FastAPI-based application for visualizing and analyzing leads stored in a PostgreSQL database, keyed by Indian pincodes. This dashboard supports advanced lead mapping, hoverable metadata, cross-sell recommendations, and portfolio analytics.

## Features
- Lead count visualization by Indian pincodes
- Aggregated metadata per pincode (loan type distribution, avg loan amount, avg income, employment types)
- Cross-sell recommendations based on behavioral and demographic similarity
- Interactive India map with hoverable metadata
- Filter leads by product type, employment type, income, and loan amount
- Portfolio analytics via charts: pie, bar, heatmap
- Async backend with caching for high performance


## Frontend Features
- India Map Visualization: Hover to view metadata per pincode
- Lead Table: Click a pincode to see all leads in a grid/table
- Filter Panel: Filter by product type, loan amount, employment type, etc.
- Cross-Sell Panel: Suggest similar leads/products for a pincode
- Portfolio Analytics: Pie/bar/heatmap showing loan distribution by type, employment, income bands

# Tech Stack

## Backend:

FastAPI (Python)
PostgreSQL
Async DB queries (asyncpg / SQLAlchemy async)
Redis caching (optional for aggregations)

## Frontend:

React or Vue.js
D3.js / Leaflet.js / Mapbox GL JS for India map visualization
Chart.js / ApexCharts for interactive charts