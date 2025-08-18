# Kissan Mitra (Farmer's Friend) - Agricultural AI System

An advanced AI-powered voice assistance system designed to help Indian farmers with agricultural information and decision support.

## Overview

Kissan Mitra is a serverless, event-driven architecture that enables farmers to access critical agricultural information through voice conversations. The system can provide:

- Weather forecasts and agricultural advisories
- Crop recommendations based on soil, climate, and season
- Current market prices and trends
- Information on government schemes and benefits
- Pest management advice

## Architecture

The system follows a serverless, event-driven architecture with these key components:

1. **Voice Interface** - Handles phone calls and voice interactions
2. **AI Agent** - Processes queries and generates responses using OpenAI
3. **Knowledge Base** - Vector and graph databases with agricultural information
4. **Data Integration** - Collects and processes data from various sources

## Project Structure

```
├── cloudformation/            # AWS resource definitions
│   └── agricultural-ai-resources.yml
├── lambdas/                   # Lambda function code
│   ├── agent-tools/           # Agent tool functions implementation
│   ├── data-processing/       # Data processing and ETL logic
│   └── voice-gateway/         # Voice gateway for call handling
├── src/                       # Source code for local development
│   ├── agent/                 # Agent logic and tools
│   ├── data/                  # Database interaction code
│   ├── scripts/               # Utility scripts
│   ├── utils/                 # Helper functions
│   └── voice/                 # Voice processing code
├── public/                    # Static web content
├── deploy.sh                  # Deployment script
├── generate-sample-data.sh    # Sample data generator
└── iam-policies.md            # IAM policy documentation
```

## AWS Resources

The system uses the following AWS resources:

1. **DynamoDB Tables**
   - Vector Database Table - For semantic search
   - Knowledge Graph Table - For entity relationships
   - Time Series Table - For temporal data (weather, prices)
   - Session Table - For voice session management

2. **S3 Bucket**
   - Raw data storage
   - Processed data
   - Vector embeddings
   - Audio files

3. **Lambda Functions**
   - Voice Gateway - Handles voice sessions
   - Agent Tools - Implements domain-specific tools
   - Data Processing - ETL and data integration

4. **OpenSearch Domain**
   - For efficient vector search

5. **API Gateway**
   - Exposes voice API endpoints

## Deployment

### Prerequisites

1. AWS CLI installed and configured
2. Node.js 18.x or higher
3. OpenAI API key

### Deploying the System

1. **Clone the repository**

```bash
git clone https://github.com/PSY27/Kisan-Mitra.git
cd Kissan-Mitra
```

2. **Deploy the AWS resources**

```bash
# Make scripts executable if needed
chmod +x deploy.sh generate-sample-data.sh

# Deploy with default settings
./deploy.sh

# Or customize with options
./deploy.sh --env dev --stack-name agricultural-ai-dev --bucket-prefix agricultural-ai-data
```

3. **Generate and upload sample data**

```bash
# Generate sample data locally
./generate-sample-data.sh

# Or generate and upload to the deployed S3 bucket
./generate-sample-data.sh --bucket your-bucket-name --env dev
```

4. **Process the data**

```bash
# Invoke the data processing Lambda function
aws lambda invoke --function-name dev-data-processing --payload '{"operation":"process_daily_data"}' response.json
```

## IAM Policies

For managing this system, specific IAM policies are required. See [iam-policies.md](iam-policies.md) for detailed information on the required permissions and recommended security practices.

## Lambda Functions

### Voice Gateway Lambda

Handles the voice interaction between the user and the OpenAI Voice Agent, including:
- Session creation and management
- Audio streaming
- Tool function invocation

### Agent Tools Lambda

Provides domain-specific tools for the AI agent, including:
- Weather forecasts
- Crop recommendations
- Market price analysis
- Government scheme lookups
- Pest management advice

### Data Processing Lambda

Handles data collection, transformation, and storage:
- Fetches data from external sources
- Processes and transforms data
- Generates vector embeddings
- Updates knowledge bases

## DynamoDB Data Models

### Vector Database Table

```
{
  id: "crop:wheat",  // Partition key
  text: "Detailed information about wheat...",
  vector: "Base64-encoded embedding vector",
  metadata: "JSON object with additional info"
}
```

### Knowledge Graph Table

```
{
  nodeId: "crop:wheat",  // Partition key
  relationshipType: "grown_in",  // Sort key
  targetNodeId: "location:punjab",
  properties: "JSON object with relationship properties"
}
```

### Time Series Table

```
{
  metricId: "weather:temperature:pune",  // Partition key
  timestamp: 1628097600000,  // Sort key (epoch milliseconds)
  value: 32.5,
  location: { "district": "pune", "state": "maharashtra" },
  source: "IMD",
  expiryTime: 1659633600  // TTL
}
```

## Local Development

For local development and testing:

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run tests
npm test
```

## Support and Contribution

For support, please open an issue on the GitHub repository. Contributions are welcome through pull requests.

## License

This project is licensed under the MIT License.
