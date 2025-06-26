import express, { Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';

// Import Express namespace for type declarations
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

// Load environment variables
dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON
app.use(express.json());
const API_KEY: string = process.env.GOOGLE_API_KEY || '';
const VEHICLE_DB_API_KEY: string = process.env.VEHICLE_DB_API_KEY || '';

// Validate API keys
if (!API_KEY) {
  console.error('GOOGLE_API_KEY is not set in environment variables');
  process.exit(1);
}

if (!VEHICLE_DB_API_KEY) {
  console.error('VEHICLE_DB_API_KEY is not set in environment variables');
  console.error('Please get your API key from https://www.vehicledatabases.com/');
  process.exit(1);
}

// Interface for Google Vision API response
interface TextAnnotation {
  locale?: string;
  description: string;
  boundingPoly: {
    vertices: Array<{ x: number; y: number }>;
  };
}

interface VisionApiResponse {
  responses: Array<{
    textAnnotations: TextAnnotation[];
  }>;
}

// Vehicle Databases API Response Interface
interface VehicleDatabasesResponse {
  status: string;
  data: {
    "registration number": string;
    vehicle_description: {
      year: string;
      make: string;
      model: string;
      bodystyle: string;
      color: string;
      engine: string;
      cylinders: string;
      gears: string;
      fuel_type: string;
    };
    vehicle_registration: {
      date_first_registered: string;
    };
    mot_tax_dues: {
      mot_due: {
        status: string;
        "ends on": string;
      };
      tax_due: {
        status: string;
        "ends on": string;
      };
    };
    vehicle_performance: {
      power: {
        bhp: string;
        kw: string;
      };
      max_speed: {
        mph: string;
      };
    };
    fuel_economy: {
      combined: {
        mpg: string;
      };
      extra_urban: {
        mpg: string;
      };
      urban_cold: {
        mpg: string;
      };
    };
    co2_emissions_figures: {
      co2_emission: string;
      ved_co2_band: string;
    };
  };
}

// Simplified interface for frontend
interface VehicleData {
  registrationNumber: string;
  year: string;
  make: string;
  model: string;
  bodystyle: string;
  color: string;
  engine: string;
  cylinders: string;
  gears: string;
  fuel_type: string;
  date_first_registered: string;
  mot_due_status: string;
  mot_due_ends: string;
  tax_due_status: string;
  tax_due_ends: string;
  power_bhp: string;
  power_kw: string;
  max_speed_mph: string;
  fuel_economy_combined: string;
  fuel_economy_extra_urban: string;
  fuel_economy_urban: string;
  co2_emission: string;
  ved_co2_band: string;
}

interface VehicleDatabasesErrorResponse {
  status: string;
  message?: string;
}

// Extend Request interface to include file
interface MulterRequest extends Request {
  file: Express.Multer.File;
}



// Vehicle Databases API Lookup Function
async function lookupVehicle(registrationNumber: string): Promise<VehicleData | null> {
  try {
    const cleanReg = registrationNumber.replace(/\s+/g, '').toUpperCase();
    console.log(`Looking up vehicle: ${cleanReg}`);

    const response = await axios.get<VehicleDatabasesResponse>(
      `https://api.vehicledatabases.com/uk-registration-decode/${cleanReg}`,
      {
        timeout: 10000,
        headers: {
          'x-AuthKey': VEHICLE_DB_API_KEY
        }
      }
    );

    console.log('Vehicle Databases API response:', response.data);
    
    if (response.data.status !== 'success') {
      console.log(`Vehicle lookup failed: ${response.data.status}`);
      return null;
    }

    // Transform the response to our simplified interface
    const apiData = response.data.data;
    const vehicleData: VehicleData = {
      registrationNumber: apiData["registration number"],
      year: apiData.vehicle_description.year,
      make: apiData.vehicle_description.make,
      model: apiData.vehicle_description.model,
      bodystyle: apiData.vehicle_description.bodystyle,
      color: apiData.vehicle_description.color,
      engine: apiData.vehicle_description.engine,
      cylinders: apiData.vehicle_description.cylinders,
      gears: apiData.vehicle_description.gears,
      fuel_type: apiData.vehicle_description.fuel_type,
      date_first_registered: apiData.vehicle_registration.date_first_registered,
      mot_due_status: apiData.mot_tax_dues.mot_due.status,
      mot_due_ends: apiData.mot_tax_dues.mot_due["ends on"],
      tax_due_status: apiData.mot_tax_dues.tax_due.status,
      tax_due_ends: apiData.mot_tax_dues.tax_due["ends on"],
      power_bhp: apiData.vehicle_performance.power.bhp,
      power_kw: apiData.vehicle_performance.power.kw,
      max_speed_mph: apiData.vehicle_performance.max_speed.mph,
      fuel_economy_combined: apiData.fuel_economy.combined.mpg,
      fuel_economy_extra_urban: apiData.fuel_economy.extra_urban.mpg,
      fuel_economy_urban: apiData.fuel_economy.urban_cold.mpg,
      co2_emission: apiData.co2_emissions_figures.co2_emission,
      ved_co2_band: apiData.co2_emissions_figures.ved_co2_band,
    };
    
    return vehicleData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        console.log(`Vehicle not found: ${registrationNumber}`);
        return null;
      } else if (error.response?.data) {
        console.error('Vehicle Databases API error:', error.response.data);
      } else {
        console.error('Vehicle Databases API request failed:', error.message);
      }
    } else {
      console.error('Unexpected error during vehicle lookup:', error);
    }
    return null;
  }
}

app.post('/upload', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const multerReq = req as MulterRequest;
    const imagePath: string = multerReq.file.path;
    const imageBuffer: Buffer = fs.readFileSync(imagePath);
    const base64Image: string = imageBuffer.toString('base64');

    const response = await axios.post<VisionApiResponse>(
      `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
      {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }
    );

    const textAnnotations = response.data.responses[0].textAnnotations;

    // Clean up local file after processing
    fs.unlinkSync(imagePath);

    // Debug: Log the raw response
    console.log('Raw Vision API response:', JSON.stringify(response.data, null, 2));
    console.log('Text annotations count:', textAnnotations?.length || 0);
    
    // Log ALL detected text for debugging
    if (textAnnotations) {
      console.log('=== ALL DETECTED TEXT ===');
      textAnnotations.forEach((annotation, index) => {
        console.log(`Text ${index}: "${annotation.description}"`);
      });
      console.log('=========================');
    }

    // Process and filter the detected text
    if (!textAnnotations || textAnnotations.length === 0) {
      console.log('No text annotations found');
      res.json({ 
        text: [], 
        message: 'No text detected in the image',
        hasText: false 
      });
      return;
    }

    // The first annotation contains the full detected text
    // Following annotations contain individual words/characters
    const fullText = textAnnotations[0]?.description?.trim();
    console.log('Full text from first annotation:', fullText);
    
    // License plate specific filtering
    const isTimestamp = /^\d{2}\.\d{2}\.\d{2,4}\s+\d{1,2}:\d{2}:\d{2}$/.test(fullText?.trim() || '');
    const isShortMeaningless = fullText && fullText.trim().length < 2;
    
    // UK License plate validation
    const isValidUKLicensePlate = (text: string): boolean => {
      const cleanText = text.replace(/\s+/g, '').toUpperCase();
      
      // UK license plate patterns
      const patterns = [
        /^[A-Z]{2}\d{2}[A-Z]{3}$/, // Current format: AB12 CDE (e.g., YF65CVK)
        /^[A-Z]\d{1,3}[A-Z]{3}$/, // Prefix format: A123 BCD
        /^[A-Z]{3}\d{1,3}[A-Z]$/, // Suffix format: ABC 123D
        /^[A-Z]{1,3}\d{1,4}$/, // Dateless format: ABC 1234
        /^[A-Z]{2}\d{2}$/, // Partial current format first part: AB12
        /^[A-Z]{3}$/, // Partial current format second part: CDE
      ];
      
      // Special handling for common splits
      if (cleanText.length >= 7) {
        // Check if it's a valid current format (most common)
        if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(cleanText)) {
          return true;
        }
      }
      
      return patterns.some(pattern => pattern.test(cleanText));
    };
    
    // Extract potential license plates from all detected text
    const extractLicensePlates = (annotations: any[]): string[] => {
      const plates: string[] = [];
      
      // Get all text segments excluding the first one (which is the full text)
      const textSegments = annotations.slice(1).map(a => a.description?.trim()).filter(Boolean);
      console.log('Text segments for plate detection:', textSegments);
      
      // Method 1: Check the full text for complete license plates
      if (fullText) {
        // Remove line breaks and check
        const cleanFullText = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        console.log('Clean full text:', cleanFullText);
        
        // Extract potential license plate from full text using regex
        const plateMatches = cleanFullText.match(/[A-Z]{2}\d{2}\s*[A-Z]{3}/g);
        if (plateMatches) {
          plateMatches.forEach(match => {
            const cleanPlate = match.replace(/\s+/g, '').toUpperCase();
            console.log('Found plate in full text:', cleanPlate);
            plates.push(cleanPlate);
          });
        }
      }
      
      // Method 2: Check individual annotations
      annotations.forEach(annotation => {
        const text = annotation.description?.trim();
        if (text && isValidUKLicensePlate(text)) {
          plates.push(text.replace(/\s+/g, '').toUpperCase());
        }
      });
      
      // Method 3: Try to combine adjacent text segments to form license plates
      for (let i = 0; i < textSegments.length - 1; i++) {
        const combined = `${textSegments[i]} ${textSegments[i + 1]}`;
        console.log('Trying combination:', combined);
        if (isValidUKLicensePlate(combined)) {
          const cleanPlate = combined.replace(/\s+/g, '').toUpperCase();
          console.log('Valid plate found:', cleanPlate);
          plates.push(cleanPlate);
        }
      }
      
      // Method 4: Try combining 3 segments (e.g., "YF", "65", "CVK")
      for (let i = 0; i < textSegments.length - 2; i++) {
        const combined = `${textSegments[i]}${textSegments[i + 1]} ${textSegments[i + 2]}`;
        console.log('Trying 3-segment combination:', combined);
        if (isValidUKLicensePlate(combined)) {
          const cleanPlate = combined.replace(/\s+/g, '').toUpperCase();
          console.log('Valid 3-segment plate found:', cleanPlate);
          plates.push(cleanPlate);
        }
      }
      
      return [...new Set(plates)]; // Remove duplicates
    };
    
    const detectedPlates = extractLicensePlates(textAnnotations);
    
    console.log('Detected plates:', detectedPlates);
    console.log('Is timestamp?', isTimestamp);
    console.log('Is short/meaningless?', isShortMeaningless);
    console.log('Raw text length:', fullText?.length);
    
    // Also collect all meaningful text (not just the first one)
    const allText = textAnnotations.map(annotation => annotation.description).join(' | ');
    console.log('All detected text combined:', allText);
    
    // Prioritize license plates over general text
    if (detectedPlates.length > 0) {
      console.log('License plates detected:', detectedPlates);
      
      // Lookup vehicle details for the first detected plate
      let vehicleData = null;
      if (detectedPlates.length > 0) {
        vehicleData = await lookupVehicle(detectedPlates[0]);
      }
      
      res.json({ 
        hasText: true, 
        text: textAnnotations,
        fullText: detectedPlates.join(', '),
        allText: allText,
        licensePlates: detectedPlates,
        vehicleData: vehicleData,
        message: vehicleData 
          ? `License plate detected: ${detectedPlates[0]} - Vehicle found!`
          : `License plate(s) detected: ${detectedPlates.join(', ')} - Vehicle not found in database`
      });
      return;
    }

    const meaningfulText = fullText && fullText.length > 0 && !isTimestamp && !isShortMeaningless ? fullText : null;

    if (!meaningfulText) {
      console.log('No meaningful text after filtering - no license plates found');
      res.json({ 
        text: [], 
        message: 'No meaningful text or license plates detected in the image',
        hasText: false,
        licensePlates: []
      });
      return;
    }

    console.log('General text detected (no license plates):', meaningfulText);
    
    // Return general text if no license plates found
    res.json({ 
      text: textAnnotations,
      fullText: meaningfulText,
      allText: allText,
      licensePlates: [],
      message: 'Text detected but no valid UK license plates found',
      hasText: true 
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image' });
  }
});

// Dedicated vehicle lookup endpoint
app.post('/vehicle-lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { registrationNumber } = req.body;
    
    if (!registrationNumber) {
      res.status(400).json({ error: 'Registration number is required' });
      return;
    }

    const vehicleData = await lookupVehicle(registrationNumber);
    
    if (vehicleData) {
      res.json({
        success: true,
        vehicleData: vehicleData,
        message: `Vehicle details found for ${registrationNumber}`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        message: `No vehicle found for registration number: ${registrationNumber}`
      });
    }
  } catch (error) {
    console.error('Error in vehicle lookup endpoint:', error);
    res.status(500).json({ error: 'Internal server error during vehicle lookup' });
  }
});

app.listen(3000, (): void => {
  console.log('Server running on port 3000');
  console.log('Available endpoints:');
  console.log('  POST /upload - Upload image for license plate detection');
  console.log('  POST /vehicle-lookup - Direct vehicle lookup');
  console.log('  Vehicle Databases API: Ready');
});