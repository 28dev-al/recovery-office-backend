# Analytics & Reporting System

The Recovery Office backend includes a comprehensive analytics and reporting system to provide business insights and data visualization capabilities. This document outlines the key features and how to use them.

## Table of Contents

1. [Key Features](#key-features)
2. [API Endpoints](#api-endpoints)
3. [Report Generation](#report-generation)
4. [Data Metrics](#data-metrics)
5. [Scheduled Reports](#scheduled-reports)

## Key Features

- **Dashboard Metrics**: Combined metrics for a comprehensive business overview
- **Booking Statistics**: Track bookings by status, date, and revenue
- **Service Popularity**: Identify the most popular services and revenue generators
- **Client Acquisition**: Monitor client growth trends over time
- **Waitlist Metrics**: Analyze waitlist patterns and conversion rates
- **Report Export**: Generate reports in CSV, Excel, and PDF formats
- **Scheduled Reports**: Set up automated report delivery via email

## API Endpoints

All analytics endpoints are protected and require admin authentication.

### Dashboard Data

```
GET /api/analytics/dashboard
```

Returns a comprehensive set of metrics including booking stats, top services, client acquisition, and waitlist metrics.

Query parameters:
- `startDate` (optional): Start date for filtering (default: 30 days ago)
- `endDate` (optional): End date for filtering (default: today)

### Booking Statistics

```
GET /api/analytics/bookings
```

Returns detailed booking statistics.

Query parameters:
- `startDate` (optional): Start date for filtering (default: 30 days ago)
- `endDate` (optional): End date for filtering (default: today)

### Service Popularity

```
GET /api/analytics/services
```

Returns service popularity metrics sorted by booking count.

Query parameters:
- `startDate` (optional): Start date for filtering (default: 30 days ago)
- `endDate` (optional): End date for filtering (default: today)
- `limit` (optional): Maximum number of services to return (default: 10)

### Client Acquisition

```
GET /api/analytics/clients
```

Returns client acquisition metrics over time.

Query parameters:
- `period` (optional): Time period grouping - 'daily', 'weekly', 'monthly' (default: 'monthly')
- `limit` (optional): Maximum number of periods to return (default: 12)

### Waitlist Metrics

```
GET /api/analytics/waitlist
```

Returns waitlist metrics including conversion rates.

Query parameters:
- `startDate` (optional): Start date for filtering (default: 30 days ago)
- `endDate` (optional): End date for filtering (default: today)

## Report Generation

Reports can be exported in various formats through the following endpoint:

```
GET /api/analytics/export/:reportType/:format
```

Parameters:
- `reportType`: Type of report - 'booking-stats', 'service-popularity', 'client-acquisition', 'waitlist-metrics'
- `format`: Export format - 'csv', 'excel', 'pdf'

Query parameters:
- `startDate` (optional): Start date for filtering (default: 30 days ago)
- `endDate` (optional): End date for filtering (default: today)
- `period` (optional): For client-acquisition reports - 'daily', 'weekly', 'monthly'
- `limit` (optional): Maximum number of records to include

Example:
```
GET /api/analytics/export/booking-stats/pdf?startDate=2023-01-01&endDate=2023-01-31
```

## Data Metrics

### Booking Statistics

- Total bookings by status (confirmed, completed, cancelled, pending)
- Daily booking counts
- Recurring booking counts
- Total revenue from confirmed/completed bookings

### Service Popularity

- Booking count per service
- Revenue generated per service
- Waitlist demand per service
- Cancellation rate per service

### Client Acquisition

- New client count by period (daily, weekly, monthly)
- Marketing consent percentage
- Client growth trend

### Waitlist Metrics

- Waitlist entries by status
- Conversion rate (waitlist to booking)
- Average time from waitlist to booking
- Top requested services

## Scheduled Reports

Reports can be scheduled for automatic email delivery:

```
POST /api/analytics/schedule-report
```

Request body:
```json
{
  "reportType": "booking-stats",
  "format": "pdf",
  "email": "admin@example.com",
  "frequency": "weekly",
  "startDate": "2023-01-01",
  "endDate": "2023-01-31"
}
```

Parameters:
- `reportType`: Type of report - 'booking-stats', 'service-popularity', 'client-acquisition', 'waitlist-metrics'
- `format`: Export format - 'csv', 'excel', 'pdf'
- `email`: Email address to receive the report
- `frequency`: Frequency of delivery - 'once', 'daily', 'weekly', 'monthly'
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering
- `period` (optional): For client-acquisition reports

Note: In the current implementation, the 'once' frequency is fully implemented. For recurring schedules, a proper job scheduler would need to be configured (see Development Notes).

## Development Notes

- Redis caching is applied to analytics endpoints to improve performance
- Report generation is CPU-intensive, especially for PDF format
- For production deployment with scheduled reports, consider using a job scheduler like node-cron
- MongoDB aggregation pipelines are used extensively for analytics queries
- The analytics system is designed to handle large datasets efficiently 