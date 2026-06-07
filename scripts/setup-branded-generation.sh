#!/bin/bash

# Setup script for Branded Content Generation
# Configures environment variables and guides through database setup

set -e

echo "🎨 KAPI Branded Content Generation Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local from .env.example.branded${NC}"
    cp .env.example.branded .env.local
    echo -e "${GREEN}✓ Created .env.local${NC}"
else
    echo -e "${YELLOW}⚠ .env.local already exists${NC}"
fi

echo ""
echo -e "${BLUE}Step 1: Configure API Keys${NC}"
echo "================================"
echo ""

read -p "Enter your Eleven Labs API Key: " ELEVEN_LABS_KEY
read -p "Enter your Banana API Key: " BANANA_KEY

# Update .env.local
sed -i "s|ELEVEN_LABS_API_KEY=.*|ELEVEN_LABS_API_KEY=$ELEVEN_LABS_KEY|" .env.local
sed -i "s|BANANA_API_KEY=.*|BANANA_API_KEY=$BANANA_KEY|" .env.local

echo -e "${GREEN}✓ API Keys configured${NC}"

echo ""
echo -e "${BLUE}Step 2: Database Migrations${NC}"
echo "================================"
echo ""

echo "The following migrations need to be applied:"
echo "1. 20260607_character_profiles_and_brand_guidelines.sql"
echo "2. 20260607_insert_gema_character.sql"
echo "3. 20260607_add_credit_pricing.sql"
echo ""

read -p "Run migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying migrations..."
    npx supabase migration up 20260607_character_profiles_and_brand_guidelines.sql
    npx supabase migration up 20260607_insert_gema_character.sql
    npx supabase migration up 20260607_add_credit_pricing.sql
    echo -e "${GREEN}✓ Migrations applied${NC}"
else
    echo -e "${YELLOW}⚠ Skipped migrations. Run them manually:${NC}"
    echo "  npx supabase migration up 20260607_character_profiles_and_brand_guidelines.sql"
    echo "  npx supabase migration up 20260607_insert_gema_character.sql"
    echo "  npx supabase migration up 20260607_add_credit_pricing.sql"
fi

echo ""
echo -e "${BLUE}Step 3: Verify Configuration${NC}"
echo "================================"
echo ""

# Check environment variables
if grep -q "ELEVEN_LABS_API_KEY=$ELEVEN_LABS_KEY" .env.local; then
    echo -e "${GREEN}✓ Eleven Labs API Key configured${NC}"
else
    echo -e "${RED}✗ Failed to configure Eleven Labs API Key${NC}"
fi

if grep -q "BANANA_API_KEY=$BANANA_KEY" .env.local; then
    echo -e "${GREEN}✓ Banana API Key configured${NC}"
else
    echo -e "${RED}✗ Failed to configure Banana API Key${NC}"
fi

echo ""
echo -e "${BLUE}Step 4: Next Steps${NC}"
echo "================================"
echo ""
echo "1. Start the API server:"
echo "   npm run dev --workspace=apps/api"
echo ""
echo "2. Start the Worker:"
echo "   npm run dev --workspace=apps/worker"
echo ""
echo "3. Test the character endpoint:"
echo "   curl http://localhost:3001/studio/branded/characters"
echo ""
echo "4. Create a character (if not auto-populated):"
echo "   POST /studio/branded/characters"
echo "   {\"name\": \"Gema\", \"elevenLabsVoiceId\": \"hFyqYpDgcxGhrlIVAeYq\"}"
echo ""
echo "5. Generate an image:"
echo "   POST /studio/branded/image-branded"
echo "   {\"prompt\": \"Woman in office\", \"characterId\": \"<uuid>\"}"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "For detailed documentation, see: docs/BRANDED_GENERATION.md"
