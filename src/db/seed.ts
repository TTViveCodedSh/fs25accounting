import type { Database } from 'sql.js'

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

/** Seed universal data (categories). Settings & fiscal year are created by the setup wizard. */
export function seedDatabase(db: Database): void {
  db.exec(`
    -- Revenue: Grains
    INSERT INTO category (name, type, icon) VALUES ('Wheat', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Barley', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Oat', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Canola', 'revenue', '${esc('🌻')}');
    INSERT INTO category (name, type, icon) VALUES ('Corn', 'revenue', '${esc('🌽')}');
    INSERT INTO category (name, type, icon) VALUES ('Sorghum', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Soybean', 'revenue', '${esc('🫘')}');
    INSERT INTO category (name, type, icon) VALUES ('Sunflower', 'revenue', '${esc('🌻')}');
    INSERT INTO category (name, type, icon) VALUES ('Rice', 'revenue', '${esc('🍚')}');
    INSERT INTO category (name, type, icon) VALUES ('Long Grain Rice', 'revenue', '${esc('🍚')}');

    -- Revenue: Root Crops
    INSERT INTO category (name, type, icon) VALUES ('Potato', 'revenue', '${esc('🥔')}');
    INSERT INTO category (name, type, icon) VALUES ('Sugar Beet', 'revenue', '${esc('🟣')}');
    INSERT INTO category (name, type, icon) VALUES ('Sugarcane', 'revenue', '${esc('🎋')}');
    INSERT INTO category (name, type, icon) VALUES ('Red Beet', 'revenue', '${esc('🟣')}');
    INSERT INTO category (name, type, icon) VALUES ('Carrots', 'revenue', '${esc('🥕')}');
    INSERT INTO category (name, type, icon) VALUES ('Parsnip', 'revenue', '${esc('🥕')}');

    -- Revenue: Vegetables & Herbs
    INSERT INTO category (name, type, icon) VALUES ('Spinach', 'revenue', '${esc('🥬')}');
    INSERT INTO category (name, type, icon) VALUES ('Peas', 'revenue', '${esc('🟢')}');
    INSERT INTO category (name, type, icon) VALUES ('Green Beans', 'revenue', '${esc('🫛')}');
    INSERT INTO category (name, type, icon) VALUES ('Lettuce', 'revenue', '${esc('🥬')}');
    INSERT INTO category (name, type, icon) VALUES ('Tomatoes', 'revenue', '${esc('🍅')}');
    INSERT INTO category (name, type, icon) VALUES ('Cabbage', 'revenue', '${esc('🥬')}');
    INSERT INTO category (name, type, icon) VALUES ('Chili', 'revenue', '${esc('🌶️')}');
    INSERT INTO category (name, type, icon) VALUES ('Garlic', 'revenue', '${esc('🧄')}');
    INSERT INTO category (name, type, icon) VALUES ('Spring Onion', 'revenue', '${esc('🧅')}');

    -- Revenue: Fruits & Mushrooms
    INSERT INTO category (name, type, icon) VALUES ('Grapes', 'revenue', '${esc('🍇')}');
    INSERT INTO category (name, type, icon) VALUES ('Olives', 'revenue', '${esc('🫒')}');
    INSERT INTO category (name, type, icon) VALUES ('Strawberries', 'revenue', '${esc('🍓')}');
    INSERT INTO category (name, type, icon) VALUES ('Mushrooms', 'revenue', '${esc('🍄')}');

    -- Revenue: Forage & Fiber
    INSERT INTO category (name, type, icon) VALUES ('Grass', 'revenue', '${esc('🌿')}');
    INSERT INTO category (name, type, icon) VALUES ('Hay', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Straw', 'revenue', '${esc('🌾')}');
    INSERT INTO category (name, type, icon) VALUES ('Silage', 'revenue', '${esc('🟢')}');
    INSERT INTO category (name, type, icon) VALUES ('Cotton', 'revenue', '${esc('🧵')}');
    INSERT INTO category (name, type, icon) VALUES ('Poplar', 'revenue', '${esc('🌳')}');

    -- Revenue: Livestock
    INSERT INTO category (name, type, icon) VALUES ('Cattle', 'revenue', '${esc('🐄')}');
    INSERT INTO category (name, type, icon) VALUES ('Pigs', 'revenue', '${esc('🐷')}');
    INSERT INTO category (name, type, icon) VALUES ('Sheep', 'revenue', '${esc('🐑')}');
    INSERT INTO category (name, type, icon) VALUES ('Chickens', 'revenue', '${esc('🐔')}');
    INSERT INTO category (name, type, icon) VALUES ('Horses', 'revenue', '${esc('🐴')}');
    INSERT INTO category (name, type, icon) VALUES ('Goats', 'revenue', '${esc('🐐')}');
    INSERT INTO category (name, type, icon) VALUES ('Water Buffalo', 'revenue', '${esc('🐃')}');

    -- Revenue: Animal Products
    INSERT INTO category (name, type, icon) VALUES ('Milk', 'revenue', '${esc('🥛')}');
    INSERT INTO category (name, type, icon) VALUES ('Eggs', 'revenue', '${esc('🥚')}');
    INSERT INTO category (name, type, icon) VALUES ('Wool', 'revenue', '${esc('🧶')}');
    INSERT INTO category (name, type, icon) VALUES ('Honey', 'revenue', '${esc('🍯')}');

    -- Revenue: Forestry
    INSERT INTO category (name, type, icon) VALUES ('Wood', 'revenue', '${esc('🪵')}');
    INSERT INTO category (name, type, icon) VALUES ('Wood Chips', 'revenue', '${esc('🪵')}');
    INSERT INTO category (name, type, icon) VALUES ('Planks', 'revenue', '${esc('🪵')}');

    -- Revenue: Dairy
    INSERT INTO category (name, type, icon) VALUES ('Butter', 'revenue', '${esc('🧈')}');
    INSERT INTO category (name, type, icon) VALUES ('Cheese', 'revenue', '${esc('🧀')}');
    INSERT INTO category (name, type, icon) VALUES ('Goat Cheese', 'revenue', '${esc('🧀')}');
    INSERT INTO category (name, type, icon) VALUES ('Buffalo Mozzarella', 'revenue', '${esc('🧀')}');
    INSERT INTO category (name, type, icon) VALUES ('Bottled Milk', 'revenue', '${esc('🥛')}');

    -- Revenue: Oils
    INSERT INTO category (name, type, icon) VALUES ('Sunflower Oil', 'revenue', '${esc('🌻')}');
    INSERT INTO category (name, type, icon) VALUES ('Olive Oil', 'revenue', '${esc('🫒')}');
    INSERT INTO category (name, type, icon) VALUES ('Canola Oil', 'revenue', '${esc('🌻')}');

    -- Revenue: Bakery & Processed Food
    INSERT INTO category (name, type, icon) VALUES ('Flour', 'revenue', '${esc('🫓')}');
    INSERT INTO category (name, type, icon) VALUES ('Rice Flour', 'revenue', '${esc('🍚')}');
    INSERT INTO category (name, type, icon) VALUES ('Sugar', 'revenue', '${esc('🍬')}');
    INSERT INTO category (name, type, icon) VALUES ('Bread', 'revenue', '${esc('🍞')}');
    INSERT INTO category (name, type, icon) VALUES ('Cake', 'revenue', '${esc('🎂')}');
    INSERT INTO category (name, type, icon) VALUES ('Cereal', 'revenue', '${esc('🥣')}');
    INSERT INTO category (name, type, icon) VALUES ('Chocolate', 'revenue', '${esc('🍫')}');
    INSERT INTO category (name, type, icon) VALUES ('Potato Chips', 'revenue', '${esc('🍟')}');

    -- Revenue: Preserved & Packed
    INSERT INTO category (name, type, icon) VALUES ('Raisins', 'revenue', '${esc('🍇')}');
    INSERT INTO category (name, type, icon) VALUES ('Grape Juice', 'revenue', '${esc('🧃')}');
    INSERT INTO category (name, type, icon) VALUES ('Soup', 'revenue', '${esc('🍲')}');
    INSERT INTO category (name, type, icon) VALUES ('Kimchi', 'revenue', '${esc('🥬')}');
    INSERT INTO category (name, type, icon) VALUES ('Canned Vegetables', 'revenue', '${esc('🥫')}');

    -- Revenue: Textiles
    INSERT INTO category (name, type, icon) VALUES ('Fabric', 'revenue', '${esc('🧵')}');
    INSERT INTO category (name, type, icon) VALUES ('Clothes', 'revenue', '${esc('👕')}');
    INSERT INTO category (name, type, icon) VALUES ('Rope', 'revenue', '${esc('🪢')}');

    -- Revenue: Crafted & Industrial
    INSERT INTO category (name, type, icon) VALUES ('Furniture', 'revenue', '${esc('🪑')}');
    INSERT INTO category (name, type, icon) VALUES ('Piano', 'revenue', '${esc('🎹')}');
    INSERT INTO category (name, type, icon) VALUES ('Paper', 'revenue', '${esc('📄')}');
    INSERT INTO category (name, type, icon) VALUES ('Barrels', 'revenue', '${esc('🛢️')}');
    INSERT INTO category (name, type, icon) VALUES ('Wagons', 'revenue', '${esc('🛒')}');
    INSERT INTO category (name, type, icon) VALUES ('Toy Tractors', 'revenue', '${esc('🧸')}');

    -- Revenue: Construction
    INSERT INTO category (name, type, icon) VALUES ('Cement', 'revenue', '${esc('🧱')}');
    INSERT INTO category (name, type, icon) VALUES ('Concrete Tiles', 'revenue', '${esc('🧱')}');
    INSERT INTO category (name, type, icon) VALUES ('Roof Tiles', 'revenue', '${esc('🧱')}');
    INSERT INTO category (name, type, icon) VALUES ('Prefab Walls', 'revenue', '${esc('🧱')}');

    -- Revenue: Contract Income & Other
    INSERT INTO category (name, type, icon) VALUES ('Contracts', 'revenue', '${esc('📋')}');
    INSERT INTO category (name, type, icon) VALUES ('Missions', 'revenue', '${esc('🎯')}');
    INSERT INTO category (name, type, icon) VALUES ('Subsidies', 'revenue', '${esc('🏛️')}');
    INSERT INTO category (name, type, icon) VALUES ('Capital Gain', 'revenue', '${esc('📈')}');
    INSERT INTO category (name, type, icon) VALUES ('Other Revenue', 'revenue', '${esc('💰')}');

    -- Expense: Inputs
    INSERT INTO category (name, type, icon) VALUES ('Seeds', 'expense', '${esc('🌱')}');
    INSERT INTO category (name, type, icon) VALUES ('Fertilizer', 'expense', '${esc('🧪')}');
    INSERT INTO category (name, type, icon) VALUES ('Lime', 'expense', '${esc('⚪')}');
    INSERT INTO category (name, type, icon) VALUES ('Herbicide', 'expense', '${esc('🧴')}');

    -- Expense: Operations
    INSERT INTO category (name, type, icon) VALUES ('Fuel', 'expense', '${esc('⛽')}');
    INSERT INTO category (name, type, icon) VALUES ('Worker Wages', 'expense', '${esc('👷')}');
    INSERT INTO category (name, type, icon) VALUES ('Maintenance', 'expense', '${esc('🔧')}');
    INSERT INTO category (name, type, icon) VALUES ('Hand Tools', 'expense', '${esc('🧰')}');
    INSERT INTO category (name, type, icon) VALUES ('Vehicle Rent', 'expense', '${esc('🚜')}');

    -- Expense: Animals
    INSERT INTO category (name, type, icon) VALUES ('Animal Feed', 'expense', '${esc('🌿')}');

    -- Expense: Financial (auto-generated)
    INSERT INTO category (name, type, icon) VALUES ('Lease Interest', 'expense', '${esc('📄')}');
    INSERT INTO category (name, type, icon) VALUES ('Loan Interest', 'expense', '${esc('🏦')}');

    -- Expense: Exceptional
    INSERT INTO category (name, type, icon) VALUES ('Capital Loss', 'expense', '${esc('📉')}');
    INSERT INTO category (name, type, icon) VALUES ('Other Expenses', 'expense', '${esc('📦')}');

    -- Expense: Tax
    INSERT INTO category (name, type, icon) VALUES ('Corporate Tax', 'expense', '${esc('🏛️')}');
  `)
}
