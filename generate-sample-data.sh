#!/bin/bash
# Generate sample data for Agricultural AI System

set -e  # Exit on error

# Default values
BUCKET_NAME=""
ENVIRONMENT="dev"
OUTPUT_DIR="sample-data"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --bucket)
      BUCKET_NAME="$2"
      shift 2
      ;;
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./generate-sample-data.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --bucket BUCKET_NAME    S3 bucket name to upload data to"
      echo "  --env ENV               Deployment environment (dev, test, prod). Default: dev"
      echo "  --output-dir DIR        Local directory to save sample data. Default: sample-data"
      echo "  --help                  Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}===== Agricultural AI System Sample Data Generator =====${NC}"
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Output Directory:${NC} $OUTPUT_DIR"
if [ -n "$BUCKET_NAME" ]; then
  echo -e "${BLUE}S3 Bucket:${NC} $BUCKET_NAME"
fi
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"/{weather,market,crops,pests,schemes}

# Get current date
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%s)

# Generate sample weather data
echo -e "${GREEN}Generating sample weather data...${NC}"
cat > "$OUTPUT_DIR/weather/maharashtra-$DATE.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "state": "Maharashtra",
  "districts": [
    {
      "id": "pune",
      "name": "Pune",
      "data": {
        "temperature": 32.5,
        "rainfall": 0.0,
        "humidity": 65,
        "forecast": [
          {"date": "$(date -d "+1 day" +%Y-%m-%d)", "temperature": 33.1, "rainfall": 0.0},
          {"date": "$(date -d "+2 day" +%Y-%m-%d)", "temperature": 34.0, "rainfall": 5.2},
          {"date": "$(date -d "+3 day" +%Y-%m-%d)", "temperature": 31.5, "rainfall": 10.0},
          {"date": "$(date -d "+4 day" +%Y-%m-%d)", "temperature": 30.2, "rainfall": 2.5},
          {"date": "$(date -d "+5 day" +%Y-%m-%d)", "temperature": 31.0, "rainfall": 0.0},
          {"date": "$(date -d "+6 day" +%Y-%m-%d)", "temperature": 32.5, "rainfall": 0.0},
          {"date": "$(date -d "+7 day" +%Y-%m-%d)", "temperature": 33.0, "rainfall": 0.0}
        ]
      }
    },
    {
      "id": "nagpur",
      "name": "Nagpur",
      "data": {
        "temperature": 35.2,
        "rainfall": 0.0,
        "humidity": 55,
        "forecast": [
          {"date": "$(date -d "+1 day" +%Y-%m-%d)", "temperature": 36.0, "rainfall": 0.0},
          {"date": "$(date -d "+2 day" +%Y-%m-%d)", "temperature": 36.5, "rainfall": 0.0},
          {"date": "$(date -d "+3 day" +%Y-%m-%d)", "temperature": 35.0, "rainfall": 2.0},
          {"date": "$(date -d "+4 day" +%Y-%m-%d)", "temperature": 34.0, "rainfall": 5.0},
          {"date": "$(date -d "+5 day" +%Y-%m-%d)", "temperature": 33.5, "rainfall": 1.0},
          {"date": "$(date -d "+6 day" +%Y-%m-%d)", "temperature": 34.0, "rainfall": 0.0},
          {"date": "$(date -d "+7 day" +%Y-%m-%d)", "temperature": 34.5, "rainfall": 0.0}
        ]
      }
    },
    {
      "id": "nashik",
      "name": "Nashik",
      "data": {
        "temperature": 30.0,
        "rainfall": 2.5,
        "humidity": 70,
        "forecast": [
          {"date": "$(date -d "+1 day" +%Y-%m-%d)", "temperature": 29.5, "rainfall": 1.0},
          {"date": "$(date -d "+2 day" +%Y-%m-%d)", "temperature": 30.0, "rainfall": 0.5},
          {"date": "$(date -d "+3 day" +%Y-%m-%d)", "temperature": 30.5, "rainfall": 0.0},
          {"date": "$(date -d "+4 day" +%Y-%m-%d)", "temperature": 31.0, "rainfall": 0.0},
          {"date": "$(date -d "+5 day" +%Y-%m-%d)", "temperature": 32.0, "rainfall": 0.0},
          {"date": "$(date -d "+6 day" +%Y-%m-%d)", "temperature": 31.5, "rainfall": 0.0},
          {"date": "$(date -d "+7 day" +%Y-%m-%d)", "temperature": 31.0, "rainfall": 0.0}
        ]
      }
    }
  ]
}
EOF

# Generate sample market data
echo -e "${GREEN}Generating sample market data...${NC}"
cat > "$OUTPUT_DIR/market/prices-$DATE.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$DATE",
  "crops": [
    {
      "id": "rice",
      "name": "Rice",
      "markets": [
        {
          "name": "Nagpur APMC",
          "price": 2150,
          "unit": "quintal",
          "trend": "stable"
        },
        {
          "name": "Pune APMC",
          "price": 2200,
          "unit": "quintal",
          "trend": "rising"
        },
        {
          "name": "Mumbai APMC",
          "price": 2250,
          "unit": "quintal",
          "trend": "rising"
        }
      ],
      "history": [
        {"date": "$(date -d "-6 day" +%Y-%m-%d)", "price": 2120},
        {"date": "$(date -d "-5 day" +%Y-%m-%d)", "price": 2130},
        {"date": "$(date -d "-4 day" +%Y-%m-%d)", "price": 2140},
        {"date": "$(date -d "-3 day" +%Y-%m-%d)", "price": 2150},
        {"date": "$(date -d "-2 day" +%Y-%m-%d)", "price": 2170},
        {"date": "$(date -d "-1 day" +%Y-%m-%d)", "price": 2190}
      ]
    },
    {
      "id": "wheat",
      "name": "Wheat",
      "markets": [
        {
          "name": "Nagpur APMC",
          "price": 2050,
          "unit": "quintal",
          "trend": "falling"
        },
        {
          "name": "Pune APMC",
          "price": 2100,
          "unit": "quintal",
          "trend": "stable"
        },
        {
          "name": "Mumbai APMC",
          "price": 2150,
          "unit": "quintal",
          "trend": "stable"
        }
      ],
      "history": [
        {"date": "$(date -d "-6 day" +%Y-%m-%d)", "price": 2150},
        {"date": "$(date -d "-5 day" +%Y-%m-%d)", "price": 2140},
        {"date": "$(date -d "-4 day" +%Y-%m-%d)", "price": 2120},
        {"date": "$(date -d "-3 day" +%Y-%m-%d)", "price": 2100},
        {"date": "$(date -d "-2 day" +%Y-%m-%d)", "price": 2080},
        {"date": "$(date -d "-1 day" +%Y-%m-%d)", "price": 2050}
      ]
    },
    {
      "id": "cotton",
      "name": "Cotton",
      "markets": [
        {
          "name": "Nagpur APMC",
          "price": 6200,
          "unit": "quintal",
          "trend": "rising"
        },
        {
          "name": "Pune APMC",
          "price": 6150,
          "unit": "quintal",
          "trend": "rising"
        },
        {
          "name": "Mumbai APMC",
          "price": 6300,
          "unit": "quintal",
          "trend": "rising"
        }
      ],
      "history": [
        {"date": "$(date -d "-6 day" +%Y-%m-%d)", "price": 6000},
        {"date": "$(date -d "-5 day" +%Y-%m-%d)", "price": 6050},
        {"date": "$(date -d "-4 day" +%Y-%m-%d)", "price": 6080},
        {"date": "$(date -d "-3 day" +%Y-%m-%d)", "price": 6100},
        {"date": "$(date -d "-2 day" +%Y-%m-%d)", "price": 6150},
        {"date": "$(date -d "-1 day" +%Y-%m-%d)", "price": 6200}
      ]
    }
  ]
}
EOF

# Generate sample crop data
echo -e "${GREEN}Generating sample crop data...${NC}"
cat > "$OUTPUT_DIR/crops/wheat.json" << EOF
{
  "id": "crop:wheat",
  "name": "Wheat",
  "scientific_name": "Triticum aestivum",
  "type": "Cereal",
  "description": "Wheat is a grass widely cultivated for its seed, a cereal grain which is a worldwide staple food.",
  "seasons": ["rabi"],
  "soil_types": "Loamy, clay-loam soils with good drainage",
  "climate": "Temperate, requires cool weather during growth and warmer weather during ripening",
  "water_requirements": "450-650 mm during the growing season",
  "fertilizer_requirements": "Nitrogen, phosphorus, and potassium in balanced proportions",
  "growth_duration": "100-150 days from sowing to harvest",
  "pests": ["aphids", "termites", "army_worm"],
  "diseases": ["leaf_rust", "powdery_mildew", "loose_smut"],
  "varieties": [
    {
      "name": "HD-2967",
      "yield": "45-50 quintals per hectare",
      "duration": "140-145 days",
      "features": "High yielding, disease resistant"
    },
    {
      "name": "PBW-343",
      "yield": "40-45 quintals per hectare",
      "duration": "135-140 days",
      "features": "Suitable for late sowing, heat tolerant"
    }
  ]
}
EOF

cat > "$OUTPUT_DIR/crops/rice.json" << EOF
{
  "id": "crop:rice",
  "name": "Rice",
  "scientific_name": "Oryza sativa",
  "type": "Cereal",
  "description": "Rice is the seed of the grass species Oryza sativa. As a cereal grain, it is the most widely consumed staple food for a large part of the world's human population, especially in Asia.",
  "seasons": ["kharif"],
  "soil_types": "Clay or clay-loam soils that retain water",
  "climate": "Warm, humid environment with temperature between 20-40°C",
  "water_requirements": "1200-1600 mm during the growing season",
  "fertilizer_requirements": "Nitrogen-heavy fertilization with phosphorus and potassium supplements",
  "growth_duration": "100-150 days from transplanting to harvest",
  "pests": ["stem_borer", "leaf_folder", "brown_planthopper"],
  "diseases": ["blast", "bacterial_leaf_blight", "sheath_blight"],
  "varieties": [
    {
      "name": "MTU-7029 (Swarna)",
      "yield": "55-60 quintals per hectare",
      "duration": "140-150 days",
      "features": "High yielding, widely adaptable"
    },
    {
      "name": "IR-36",
      "yield": "50-55 quintals per hectare",
      "duration": "110-120 days",
      "features": "Early maturing, disease resistant"
    }
  ]
}
EOF

cat > "$OUTPUT_DIR/crops/cotton.json" << EOF
{
  "id": "crop:cotton",
  "name": "Cotton",
  "scientific_name": "Gossypium hirsutum",
  "type": "Fiber crop",
  "description": "Cotton is a soft, fluffy staple fiber that grows in a boll around the seeds of cotton plants. It is a major cash crop in India.",
  "seasons": ["kharif"],
  "soil_types": "Deep, well-drained soils, black cotton soils are ideal",
  "climate": "Warm climate with temperature between 21-37°C",
  "water_requirements": "500-800 mm during the growing season",
  "fertilizer_requirements": "Balanced NPK, higher phosphorus during boll development",
  "growth_duration": "150-180 days from sowing to first picking",
  "pests": ["bollworm", "whitefly", "thrips"],
  "diseases": ["wilt", "leaf_curl_virus", "boll_rot"],
  "varieties": [
    {
      "name": "Bt Cotton (Bollgard II)",
      "yield": "20-25 quintals per hectare",
      "duration": "160-180 days",
      "features": "Pest resistant, higher yield"
    },
    {
      "name": "Desi Cotton (G. arboreum)",
      "yield": "12-15 quintals per hectare",
      "duration": "150-170 days",
      "features": "Drought tolerant, less input requirements"
    }
  ]
}
EOF

# Generate sample pest management data
echo -e "${GREEN}Generating sample pest management data...${NC}"
cat > "$OUTPUT_DIR/pests/aphids.json" << EOF
{
  "id": "pest:aphids",
  "name": "Aphids",
  "scientific_name": "Family Aphididae",
  "description": "Small sap-sucking insects that can cause significant damage to a variety of crops by feeding on plant sap and transmitting plant viruses.",
  "affected_crops": ["wheat", "rice", "cotton", "vegetables", "fruits"],
  "symptoms": "Curling of leaves, yellowing, stunted growth, presence of honeydew and black sooty mold, clusters of small insects on the undersides of leaves and stems.",
  "lifecycle": "Aphids reproduce rapidly under favorable conditions. Most species can reproduce both sexually and asexually. A complete lifecycle can occur within 1-2 weeks in warm weather.",
  "management": "Regular monitoring, especially during vegetative growth. Avoid excessive nitrogen fertilization which promotes aphid reproduction.",
  "prevention": "Maintain field hygiene, use resistant varieties where available, encourage beneficial insects like ladybugs and lacewings, use reflective mulches to repel aphids.",
  "organic_solutions": "Neem oil spray (2-3 ml per liter of water), insecticidal soaps, strong jets of water to dislodge aphids, release of predatory insects like ladybugs.",
  "chemical_control": "Imidacloprid (0.3 ml per liter), Acetamiprid (0.2 g per liter), Thiamethoxam (0.25 g per liter). Always follow label instructions and safety precautions."
}
EOF

cat > "$OUTPUT_DIR/pests/bollworm.json" << EOF
{
  "id": "pest:bollworm",
  "name": "Cotton Bollworm",
  "scientific_name": "Helicoverpa armigera",
  "description": "A major pest of cotton that feeds on cotton bolls, flowers, and buds. It can cause significant yield loss if not properly managed.",
  "affected_crops": ["cotton", "tomato", "corn", "chickpea", "pigeon pea"],
  "symptoms": "Circular holes in bolls, buds and flowers with larval feeding damage, presence of larvae inside bolls, premature boll opening, reduced yield.",
  "lifecycle": "Eggs are laid on tender parts of plants. Larvae go through 5-6 instars over 2-3 weeks. Pupation occurs in soil. Complete lifecycle takes 4-6 weeks depending on temperature.",
  "management": "Regular scouting for eggs and young larvae. Implement control measures when economic threshold is reached (5-10% damaged squares or bolls).",
  "prevention": "Crop rotation, early planting and harvesting, destruction of crop residues after harvest, trap cropping with marigold or okra.",
  "organic_solutions": "Bacillus thuringiensis (Bt) sprays (1-2 g per liter), neem seed kernel extract (5% solution), pheromone traps for monitoring and mass trapping.",
  "chemical_control": "For conventional cotton: Spinosad (0.5 ml per liter), Emamectin benzoate (0.2 g per liter), Chlorantraniliprole (0.3 ml per liter). Bt cotton provides built-in protection against bollworms but may still require supplemental control in heavy infestations."
}
EOF

# Generate sample government schemes
echo -e "${GREEN}Generating sample government scheme data...${NC}"
cat > "$OUTPUT_DIR/schemes/pmfby.json" << EOF
{
  "id": "scheme:pmfby",
  "name": "Pradhan Mantri Fasal Bima Yojana",
  "type": "Crop Insurance",
  "description": "A comprehensive crop insurance scheme that aims to provide insurance coverage and financial support to farmers in the event of crop failure due to natural calamities, pests, and diseases.",
  "eligibility": "All farmers growing notified crops in notified areas. Both loanee farmers (who have taken Institutional loans) and non-loanee farmers (who have not taken loans) can apply.",
  "benefits": "Financial protection against crop loss due to natural calamities, subsidized premium rates, comprehensive risk coverage from pre-sowing to post-harvest, use of technology for quick claim settlement.",
  "how_to_apply": "Loanee farmers are automatically enrolled through banks. Non-loanee farmers can apply through designated insurance companies, banks, Common Service Centers, or online portals with necessary documents and premium payment.",
  "deadlines": "For Kharif crops: July 31st, For Rabi crops: December 31st (dates may vary by state)",
  "states": ["all"],
  "farmer_type": ["all"],
  "crop_type": ["all"],
  "contact": "Local Agriculture Department, Banks, Insurance Companies, or toll-free number: 1800-180-1551",
  "website": "https://pmfby.gov.in/"
}
EOF

cat > "$OUTPUT_DIR/schemes/pmkisan.json" << EOF
{
  "id": "scheme:pmkisan",
  "name": "Pradhan Mantri Kisan Samman Nidhi",
  "type": "Direct Income Support",
  "description": "A central sector scheme that provides income support to all landholding farmers' families in the country to supplement their financial needs for agricultural inputs and other expenses.",
  "eligibility": "All landholding farmer families with cultivable land, subject to exclusion criteria. Institutional landholders are not eligible.",
  "benefits": "Financial benefit of Rs. 6,000 per year transferred directly to beneficiaries' bank accounts in three equal installments of Rs. 2,000 every four months.",
  "how_to_apply": "Farmers can self-register through the PM-KISAN portal, Common Service Centers, or with the assistance of local agriculture officers. Required documents include Aadhaar card, bank account details, and land records.",
  "deadlines": "No specific deadline, registration is open throughout the year.",
  "states": ["all"],
  "farmer_type": ["small", "marginal", "medium"],
  "crop_type": ["all"],
  "contact": "Local Agriculture Department or PM-KISAN helpline: 011-24300606",
  "website": "https://pmkisan.gov.in/"
}
EOF

# Upload to S3 if bucket name was provided
if [ -n "$BUCKET_NAME" ]; then
  echo -e "${GREEN}Uploading sample data to S3 bucket: $BUCKET_NAME${NC}"
  
  # Check if AWS CLI is installed
  if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed. Please install it first.${NC}"
    exit 1
  fi
  
  # Check if bucket exists
  if ! aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    echo -e "${RED}Error: Bucket $BUCKET_NAME does not exist or you don't have permission to access it.${NC}"
    exit 1
  fi
  
  # Upload weather data
  aws s3 cp "$OUTPUT_DIR/weather/maharashtra-$DATE.json" "s3://$BUCKET_NAME/raw/weather/maharashtra/$DATE.json"
  
  # Upload market data
  aws s3 cp "$OUTPUT_DIR/market/prices-$DATE.json" "s3://$BUCKET_NAME/raw/market/prices/$DATE.json"
  
  # Upload crop data
  for crop_file in "$OUTPUT_DIR/crops"/*.json; do
    crop_name=$(basename "$crop_file" .json)
    aws s3 cp "$crop_file" "s3://$BUCKET_NAME/raw/crops/$crop_name.json"
  done
  
  # Upload pest management data
  for pest_file in "$OUTPUT_DIR/pests"/*.json; do
    pest_name=$(basename "$pest_file" .json)
    aws s3 cp "$pest_file" "s3://$BUCKET_NAME/raw/pests/$pest_name.json"
  done
  
  # Upload government scheme data
  for scheme_file in "$OUTPUT_DIR/schemes"/*.json; do
    scheme_name=$(basename "$scheme_file" .json)
    aws s3 cp "$scheme_file" "s3://$BUCKET_NAME/raw/schemes/$scheme_name.json"
  done
  
  echo -e "${GREEN}All sample data uploaded to S3 bucket: $BUCKET_NAME${NC}"
  
  echo -e "\n${YELLOW}Next steps:${NC}"
  echo "1. Process the uploaded data by invoking the data processing Lambda function:"
  echo "   aws lambda invoke --function-name $ENVIRONMENT-data-processing --payload '{\"operation\":\"process_daily_data\"}' response.json"
  echo ""
  echo "2. Verify that the data has been processed correctly by checking the Vector Database and Knowledge Graph tables in DynamoDB"
else
  echo -e "${YELLOW}Sample data has been generated in the '$OUTPUT_DIR' directory.${NC}"
  echo -e "${YELLOW}To upload the data to S3, run this script again with the --bucket parameter.${NC}"
fi

echo -e "\n${GREEN}Sample data generation completed!${NC}"
