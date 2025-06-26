# MotorDex Backend

A Node.js backend service that detects UK license plates from images and looks up vehicle information using the Vehicle Databases API.

## Features

- 📷 **Image Processing**: Upload images via multipart/form-data
- 🔍 **OCR Text Detection**: Google Vision API for license plate recognition  
- 🚗 **UK License Plate Detection**: Advanced pattern matching for UK registration formats
- 📋 **Vehicle Data Lookup**: Comprehensive vehicle information including make, model, year, MOT, tax status, and performance data
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- ⚡ **Fast Response**: Optimized for quick license plate detection and lookup

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Cloud Vision API key
- Vehicle Databases API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Google Vision API Key (required for OCR)
GOOGLE_API_KEY=your_google_api_key_here

# Vehicle Databases API Key (required for vehicle lookup)
VEHICLE_DB_API_KEY=your_vehicle_databases_api_key_here
```

## API Key Setup

#### Google Vision API Key (Required)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Vision API
3. Create credentials and get your API key

#### Vehicle Databases API Key (Required)
1. Visit [Vehicle Databases](https://www.vehicledatabases.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. The free tier includes 15 credits to test the API

## Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start

# For development with auto-restart
npm run dev
```

The server will start on port 3000.

## API Endpoints

### POST /upload

Upload an image for license plate detection and vehicle lookup.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: image file (key: 'image')

**Response:**
```json
{
  "hasText": true,
  "text": [...],
  "fullText": "AB12 CDE",
  "licensePlates": ["AB12CDE"],
  "vehicleData": {
    "registrationNumber": "AB12CDE",
    "year": "2015",
    "make": "Audi",
    "model": "Q3 TDI S Line",
    "color": "Black",
    "engine": "1.968 cc",
    "fuel_type": "Diesel",
    "mot_due_status": "01-12-2024",
    "tax_due_status": "01-03-2025",
    "power_bhp": "148 BHP",
    "fuel_economy_combined": "60.1 mpg",
    "co2_emission": "122 g/km"
  },
  "message": "License plate detected: AB12CDE - Vehicle found!"
}
```

### POST /vehicle-lookup

Direct vehicle lookup by registration number.

**Request:**
```json
{
  "registrationNumber": "AB12CDE"
}
```

**Response:**
```json
{
  "success": true,
  "vehicleData": { ... },
  "message": "Vehicle details found for AB12CDE"
}
```

## License Plate Detection

The service supports various UK license plate formats:
- Current format: AB12 CDE
- Prefix format: A123 BCD  
- Suffix format: ABC 123D
- Dateless format: ABC 1234

## Vehicle Data

The Vehicle Databases API provides comprehensive vehicle information:
- **Vehicle Description**: Year, make, model, body style, color, engine details
- **Registration**: First registration date
- **MOT & Tax**: Due dates and status
- **Performance**: Power (BHP/kW), maximum speed
- **Fuel Economy**: Combined, extra-urban, and urban MPG
- **Emissions**: CO2 emissions and VED band

## Data Sources

- **Google Vision API**: OCR text detection from images
- **Vehicle Databases API**: UK vehicle registration data with comprehensive details including model information

## Error Handling

The API includes comprehensive error handling for:
- Invalid image uploads
- OCR processing failures  
- Vehicle lookup failures
- Network timeouts
- Invalid registration numbers

## Development

```bash
# Run in development mode with auto-restart
npm run dev

# The server will restart automatically when files change
```

## Testing

You can test the API using tools like Postman or curl:

```bash
# Test image upload
curl -X POST -F "image=@/path/to/your/image.jpg" http://localhost:3000/upload

# Test direct vehicle lookup  
curl -X POST -H "Content-Type: application/json" \
  -d '{"registrationNumber":"AB12CDE"}' \
  http://localhost:3000/vehicle-lookup
``` 