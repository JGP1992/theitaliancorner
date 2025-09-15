import { PrismaClient } from '@prisma/client';
import { AuthService } from '../lib/auth';

const prisma = new PrismaClient();

type SeedItem = {
  name: string;
  targetText?: string;
  targetNumber?: number;
  unit?: string;
  sortOrder?: number;
};

// Convert human target text to a numeric approximation when possible
function parseTarget(text?: string): { targetNumber?: number; unit?: string } {
  if (!text) return {};
  const t = text.trim().toLowerCase();
  // Examples: "10", "1/2 tub", "2 full squeeze bottles", "1 box & 1 open"
  // We'll capture a number (or fraction) and an optional unit word
  const fractionMatch = t.match(/^(\d+\s*\/\s*\d+)/);
  const numberMatch = t.match(/^(\d+(?:\.\d+)?)/);
  let targetNumber: number | undefined;
  if (fractionMatch) {
    const [a, b] = fractionMatch[0].split('/').map((s) => parseFloat(s.trim()));
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) targetNumber = a / b;
  } else if (numberMatch) {
    targetNumber = parseFloat(numberMatch[1]);
  }
  // Unit heuristic: pick last word if it's a known unit-like token
  const unitMatch = t.match(/(tub|bottle|bottles|bag|bags|box|boxes|open|case|cases|sachets?|kg|g|lids?|cups?|cones?|rolls?|pens?|calculator)$/);
  const unit = unitMatch ? unitMatch[1] : undefined;
  return { targetNumber, unit };
}

const categories: { name: string; items: SeedItem[] }[] = [
  {
    name: 'General',
    items: [
      { name: 'MaxyBon', targetText: '10' },
      { name: 'Gelato Cookies', targetText: '10' },
      { name: 'Fior De Latte 5l', targetText: '1/2 tub' },
      { name: 'Milk', targetText: '1 full' },
      { name: 'Whiped Cream', targetText: '4' },
      { name: 'Bar One Sauce', targetText: '3' },
      { name: 'Milky Bar sauce', targetText: '3' },
      { name: 'Nutella', targetText: '2 full squeeze bottles' },
      { name: 'Golden Syrup', targetText: '3' },
      { name: 'Icing sugar/castor sugar', targetText: '1kg' },
      { name: 'Spray & Cook', targetText: '2' },
      { name: 'Gas canisters', targetText: '3' },
      { name: 'Cinnamon', targetText: '1' },
      { name: 'Coffee', targetText: '1' },
      { name: 'Tea (Five Roses)', targetText: '20 bags' },
      { name: 'Tea (Rooi boss)', targetText: '20 bags' },
      { name: 'Hot Choc (Nestle)', targetText: '1/3 (of 1.75kg tub)' },
      { name: 'Chai Tea', targetText: '5 sachets' },
      { name: 'Sugar sachets (white)', targetText: '50 sachets' },
      { name: 'Sugar sachets (Brown)', targetText: '50 sachets' },
      { name: 'Candarel sachets', targetText: '20 sachets' },
      { name: 'Milkshake Chocolate', targetText: '1/4 bottle' },
      { name: 'Milkshake Caramel', targetText: '1/4 bottle' },
      { name: 'Milkshake Mint', targetText: '1/4 bottle' },
      { name: 'Milkshake Vanilla', targetText: '1/4 bottle' },
      { name: 'Ice Tea Peach', targetText: '1' },
      { name: 'Ice Tea Lemon', targetText: '1' },
      { name: 'Pancake batter', targetText: '3' },
      { name: 'Waffle batter', targetText: '4' },
      { name: 'Sprinkles', targetText: '1/4 tub' },
      { name: 'Nuts', targetText: '1 full' },
      { name: 'Buddy Coke', targetText: '12' },
      { name: 'Sparkling Water', targetText: '12' },
      { name: 'Still Water', targetText: '1 case' },
      { name: 'Fruit juice cans (mixed flavours)', targetText: '6' },
    ],
  },
  {
    name: 'Packaging',
    items: [
      { name: 'Single cup', targetText: '200' },
      { name: 'Double cup', targetText: '100' },
      { name: 'Single cone', targetText: '1 box & 1 open' },
      { name: 'Double cone', targetText: '1 box & 1 open' },
      { name: 'Spoons', targetText: '1/2 bag' },
      { name: 'Servietts', targetText: '1/2 box' },
      { name: 'Take away dish', targetText: '10' },
      { name: 'Take away packets', targetText: '20' },
      { name: 'Straws', targetText: '1/2 Pack' },
      { name: 'Milkshake cups & lids', targetText: '20' },
      { name: 'Coffe Cups Small & Lids', targetText: '50' },
      { name: 'Coffee Cups Med & Lids', targetText: '50' },
      { name: 'Ice Tea cups & lids', targetText: '20' },
      { name: 'Poli gelato takeaway tub', targetText: '20' },
    ],
  },
  {
    name: 'Cleaning',
    items: [
      { name: 'Mop', targetText: '2' },
      { name: 'Broom', targetText: '2' },
      { name: 'Floor cleaner', targetText: '1' },
      { name: 'Dish liquid', targetText: '2' },
      { name: 'Clothes', targetText: '4 good condition' },
      { name: 'Detol cleaner', targetText: '1' },
      { name: 'Hand sanitizer', targetText: '1' },
      { name: 'Cleaning sponge', targetText: '1 unopened' },
      { name: 'Paper Towel' },
      { name: 'Glass cleaner' },
      { name: 'Handy Andy' },
    ],
  },
  {
    name: 'Stationary',
    items: [
      { name: 'Till rolls', targetText: '5' },
      { name: 'Card machine rolls', targetText: '3' },
      { name: 'Working Pens', targetText: '2' },
      { name: 'Calculator', targetText: '1' },
    ],
  },
  {
    name: 'Gelato Flavors',
    items: [
      { name: 'Vanilla', targetText: '1 tub', unit: 'tub' },
      { name: 'Chocolate', targetText: '1 tub', unit: 'tub' },
      { name: 'Strawberry', targetText: '1 tub', unit: 'tub' },
      { name: 'Lemon', targetText: '1 tub', unit: 'tub' },
      { name: 'Pistachio', targetText: '1 tub', unit: 'tub' },
      { name: 'Hazelnut', targetText: '1 tub', unit: 'tub' },
      { name: 'Caramel', targetText: '1 tub', unit: 'tub' },
      { name: 'Coffee', targetText: '1 tub', unit: 'tub' },
      { name: 'Mint Chocolate Chip', targetText: '1 tub', unit: 'tub' },
      { name: 'Cookies & Cream', targetText: '1 tub', unit: 'tub' },
      { name: 'Bubblegum', targetText: '1 tub', unit: 'tub' },
      { name: 'Mango', targetText: '1 tub', unit: 'tub' },
      { name: 'Passion Fruit', targetText: '1 tub', unit: 'tub' },
      { name: 'Raspberry', targetText: '1 tub', unit: 'tub' },
      { name: 'Blueberry', targetText: '1 tub', unit: 'tub' },
      { name: 'Peach', targetText: '1 tub', unit: 'tub' },
      { name: 'Pineapple', targetText: '1 tub', unit: 'tub' },
      { name: 'Coconut', targetText: '1 tub', unit: 'tub' },
      { name: 'Banana', targetText: '1 tub', unit: 'tub' },
      { name: 'Tiramisu', targetText: '1 tub', unit: 'tub' },
      { name: 'Cannoli', targetText: '1 tub', unit: 'tub' },
      { name: 'Panna Cotta', targetText: '1 tub', unit: 'tub' },
      { name: 'Ricotta', targetText: '1 tub', unit: 'tub' },
      { name: 'Stracciatella', targetText: '1 tub', unit: 'tub' },
      { name: 'Zabaione', targetText: '1 tub', unit: 'tub' },
      { name: 'Amaretto', targetText: '1 tub', unit: 'tub' },
      { name: 'Baileys', targetText: '1 tub', unit: 'tub' },
      { name: 'Limoncello', targetText: '1 tub', unit: 'tub' },
      { name: 'Frangelico', targetText: '1 tub', unit: 'tub' },
      { name: 'Sambuca', targetText: '1 tub', unit: 'tub' },
      { name: 'Seasonal: Pumpkin Spice', targetText: '1 tub', unit: 'tub' },
      { name: 'Seasonal: Eggnog', targetText: '1 tub', unit: 'tub' },
      { name: 'Seasonal: Gingerbread', targetText: '1 tub', unit: 'tub' },
      { name: 'Seasonal: Peppermint Bark', targetText: '1 tub', unit: 'tub' },
      { name: 'Sugar Free Vanilla', targetText: '1 tub', unit: 'tub' },
      { name: 'Sugar Free Chocolate', targetText: '1 tub', unit: 'tub' },
      { name: 'Vegan Vanilla', targetText: '1 tub', unit: 'tub' },
      { name: 'Vegan Chocolate', targetText: '1 tub', unit: 'tub' },
      { name: 'Sorbet: Lemon', targetText: '1 tub', unit: 'tub' },
      { name: 'Sorbet: Mango', targetText: '1 tub', unit: 'tub' },
      { name: 'Sorbet: Raspberry', targetText: '1 tub', unit: 'tub' },
      { name: 'Sorbet: Passion Fruit', targetText: '1 tub', unit: 'tub' },
    ],
  },
];

async function main() {
  console.log('🌱 Starting database seeding...');
  const dbUrl = process.env.DATABASE_URL || '';
  const seedMode = (process.env.SEED_MODE || '').toLowerCase();
  const isMinimal = seedMode === 'minimal' || (process.env.CLEAN_SEED || '').toLowerCase() === 'true';
  const LIGHT_SEED = !isMinimal && ((process.env.LIGHT_SEED || '').toLowerCase() === 'true' || dbUrl.includes('db.prisma.io'));
  if (isMinimal) {
    console.log('⚙️ Using MINIMAL seed mode (no sample data)');
  } else if (LIGHT_SEED) {
    console.log('⚙️ Using LIGHT_SEED mode (reduced volumes)');
  } else {
    console.log('⚙️ Using FULL seed mode');
  }

  // Create permissions first
  console.log('🔐 Creating permissions...');
  const permissions = [
    // Store permissions
    { name: 'stores:read', resource: 'stores', action: 'read', description: 'View stores' },
    { name: 'stores:create', resource: 'stores', action: 'create', description: 'Create stores' },
    { name: 'stores:update', resource: 'stores', action: 'update', description: 'Update stores' },
    { name: 'stores:delete', resource: 'stores', action: 'delete', description: 'Delete stores' },
    { name: 'stores:manage_inventory', resource: 'stores', action: 'manage_inventory', description: 'Manage store inventory configuration' },

    // Stocktake permissions
    { name: 'stocktakes:read', resource: 'stocktakes', action: 'read', description: 'View stocktakes' },
    { name: 'stocktakes:create', resource: 'stocktakes', action: 'create', description: 'Create stocktakes' },
    { name: 'stocktakes:update', resource: 'stocktakes', action: 'update', description: 'Update stocktakes' },

    // Delivery permissions
    { name: 'deliveries:read', resource: 'deliveries', action: 'read', description: 'View deliveries' },
    { name: 'deliveries:create', resource: 'deliveries', action: 'create', description: 'Create deliveries' },
    { name: 'deliveries:update', resource: 'deliveries', action: 'update', description: 'Update deliveries' },

    // Production permissions
    { name: 'production:read', resource: 'production', action: 'read', description: 'View production' },
    { name: 'production:create', resource: 'production', action: 'create', description: 'Create production' },
    { name: 'production:update', resource: 'production', action: 'update', description: 'Update production' },

    // Order permissions
    { name: 'orders:read', resource: 'orders', action: 'read', description: 'View orders' },
    { name: 'orders:create', resource: 'orders', action: 'create', description: 'Create orders' },
    { name: 'orders:update', resource: 'orders', action: 'update', description: 'Update orders' },

    // Recipe permissions
    { name: 'recipes:read', resource: 'recipes', action: 'read', description: 'View recipes' },
    { name: 'recipes:create', resource: 'recipes', action: 'create', description: 'Create recipes' },
    { name: 'recipes:update', resource: 'recipes', action: 'update', description: 'Update recipes' },
    { name: 'recipes:delete', resource: 'recipes', action: 'delete', description: 'Delete recipes' },

  // Customer permissions
  { name: 'customers:read', resource: 'customers', action: 'read', description: 'View customers' },
  { name: 'customers:create', resource: 'customers', action: 'create', description: 'Create customers' },
  { name: 'customers:update', resource: 'customers', action: 'update', description: 'Update customers' },
  { name: 'customers:delete', resource: 'customers', action: 'delete', description: 'Delete customers' },

    // User management permissions
    { name: 'users:read', resource: 'users', action: 'read', description: 'View users' },
    { name: 'users:create', resource: 'users', action: 'create', description: 'Create users' },
    { name: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
    { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },

    // Role management permissions
    { name: 'roles:read', resource: 'roles', action: 'read', description: 'View roles' },
    { name: 'roles:create', resource: 'roles', action: 'create', description: 'Create roles' },
    { name: 'roles:update', resource: 'roles', action: 'update', description: 'Update roles' },
    { name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // Create roles
  console.log('👥 Creating roles...');
  const roles = [
    {
      name: 'admin',
      description: 'Full system administrator',
      permissions: permissions.map(p => p.name), // All permissions
    },
    {
      name: 'manager',
      description: 'Store manager with most permissions',
      permissions: [
        'stores:read', 'stores:update', 'stores:manage_inventory',
        'stocktakes:read', 'stocktakes:create', 'stocktakes:update',
        'deliveries:read', 'deliveries:create', 'deliveries:update',
        'production:read', 'production:create', 'production:update',
        'orders:read', 'orders:create', 'orders:update',
  'recipes:read', 'recipes:create', 'recipes:update',
  'customers:read', 'customers:create', 'customers:update',
        'users:read',
      ],
    },
    {
      name: 'store_staff',
      description: 'Store staff for daily operations',
      permissions: [
        'stores:read',
        'stocktakes:read', 'stocktakes:create', 'stocktakes:update',
        'deliveries:read',
      ],
    },
    {
      name: 'factory_worker',
      description: 'Factory worker for production',
      permissions: [
        'production:read', 'production:create', 'production:update',
        'recipes:read',
        'stocktakes:read',
      ],
    },
    {
      name: 'viewer',
      description: 'Read-only access',
      permissions: [
        'stores:read',
        'stocktakes:read',
        'deliveries:read',
        'production:read',
        'orders:read',
        'recipes:read',
  'customers:read',
        'users:read',
      ],
    },
  ];

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: {
        name: roleData.name,
        description: roleData.description,
      },
    });

    // Assign permissions to role
    for (const permName of roleData.permissions) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }
  // Optionally create a first admin user from env in minimal or full mode
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  const envFirstAdminEmail = (process.env.FIRST_ADMIN_EMAIL || '').trim();
  const envFirstAdminPassword = (process.env.FIRST_ADMIN_PASSWORD || '').trim();
  const envFirstAdminFirst = (process.env.FIRST_ADMIN_FIRSTNAME || 'System').trim();
  const envFirstAdminLast = (process.env.FIRST_ADMIN_LASTNAME || 'Administrator').trim();
  if (adminRole && envFirstAdminEmail && envFirstAdminPassword) {
    const existingEnvAdmin = await prisma.user.findUnique({ where: { email: envFirstAdminEmail } });
    if (!existingEnvAdmin) {
      await AuthService.createUser(
        envFirstAdminEmail,
        envFirstAdminPassword,
        envFirstAdminFirst,
        envFirstAdminLast,
        [adminRole.id]
      );
      console.log(`✅ Created FIRST_ADMIN user from env: ${envFirstAdminEmail}`);
    } else {
      console.log(`ℹ️ FIRST_ADMIN_EMAIL already exists: ${envFirstAdminEmail}`);
    }
  }

  // Seed packaging options
  console.log('📦 Creating packaging options...');
  const packagingOptions = [
    // Customer-facing options (restaurants/cafes/hotels)
    { name: '125 ml cup', type: 'CUP', sizeValue: 125, sizeUnit: 'ML', variableWeight: false, sortOrder: 1, allowStores: false, allowCustomers: true },
    { name: '2 L tub', type: 'TUB', sizeValue: 2, sizeUnit: 'L', variableWeight: false, sortOrder: 2, allowStores: false, allowCustomers: true },
    { name: '5 L tub', type: 'TUB', sizeValue: 5, sizeUnit: 'L', variableWeight: false, sortOrder: 3, allowStores: true, allowCustomers: true },  { name: '2.5 kg tray', type: 'TRAY', sizeValue: 2.5, sizeUnit: 'KG', variableWeight: true, sortOrder: 4, allowStores: true, allowCustomers: true },
    // Shop-facing (store) trays; variable weights allowed
    { name: '5 L tray', type: 'TRAY', sizeValue: 5, sizeUnit: 'L', variableWeight: true, sortOrder: 5, allowStores: true, allowCustomers: false },
  ];
  for (const p of packagingOptions) {
    // @ts-ignore - client may not have new model before generate
    await (prisma as any).packagingOption.upsert({
      where: { name: p.name },
      update: { type: p.type, sizeValue: p.sizeValue, sizeUnit: p.sizeUnit, variableWeight: p.variableWeight, sortOrder: p.sortOrder, isActive: true, allowStores: (p as any).allowStores ?? true, allowCustomers: (p as any).allowCustomers ?? true },
      create: { ...p, isActive: true },
    });
  }

  // In minimal mode, stop here — no demo entities, stores, customers, items, or sample records
  if (isMinimal) {
    console.log('🧹 Minimal seed complete: roles/permissions, packaging options, and optional FIRST_ADMIN only.');
    console.log('❌ Skipping creation of demo stores, customers, items, stocktakes, deliveries, suppliers, and recipes.');
    console.log('✅ Minimal seeding completed successfully!');
    return;
  }

  // Create default manager user
  console.log('👤 Creating default manager user...');
  const managerRole = await prisma.role.findUnique({ where: { name: 'manager' } });
  if (managerRole) {
    const existingManager = await prisma.user.findUnique({
      where: { email: 'manager@stocktake.com' },
    });

    if (!existingManager) {
      await AuthService.createUser(
        'manager@stocktake.com',
        'manager123',
        'Store',
        'Manager',
        [managerRole.id]
      );
      console.log('✅ Created default manager user: manager@stocktake.com / manager123');
    }
  }
  const stores = [
    { name: 'Factory', slug: 'factory', apiKey: 'store_factory_dev_key' },
    { name: 'Florenci', slug: 'florenci', apiKey: 'store_florenci_dev_key' },
    { name: 'Figtree Store', slug: 'figtree-store', apiKey: 'store_figtree_dev_key' },
    { name: 'CBD Store', slug: 'cbd-store', apiKey: 'store_cbd_dev_key' },
    { name: 'Bondi Store', slug: 'bondi-store', apiKey: 'store_bondi_dev_key' },
    { name: 'Surry Hills Store', slug: 'surry-hills-store', apiKey: 'store_surry_hills_dev_key' },
    { name: 'Newtown Store', slug: 'newtown-store', apiKey: 'store_newtown_dev_key' },
    { name: 'Manly Store', slug: 'manly-store', apiKey: 'store_manly_dev_key' },
    { name: 'Parramatta Store', slug: 'parramatta-store', apiKey: 'store_parramatta_dev_key' },
  ];

  console.log('📍 Creating stores...');
  for (const storeData of stores) {
    await prisma.store.upsert({
      where: { slug: storeData.slug },
      update: {},
      create: storeData,
    });
  }

  // Create comprehensive customers
  const customers = [
    // Restaurants
    { id: 'cust-1', name: 'Bella Vista Restaurant', type: 'restaurant', address: '123 Main St, Bella Vista', phone: '+61 2 1234 5678', email: 'info@bellavista.com.au', contactName: 'Maria Rossi' },
    { id: 'cust-2', name: 'Sydney Cafe Co', type: 'cafe', address: '456 George St, Sydney', phone: '+61 2 8765 4321', email: 'hello@sydneycafe.com.au', contactName: 'John Smith' },
    { id: 'cust-3', name: 'Bondi Beach Bistro', type: 'restaurant', address: '321 Bondi Rd, Bondi', phone: '+61 2 9999 8888', email: 'bookings@bondibistro.com.au', contactName: 'Mike Wilson' },
    { id: 'cust-4', name: 'Italian Kitchen', type: 'restaurant', address: '789 King St, Newtown', phone: '+61 2 5555 1111', email: 'orders@italiankitchen.com.au', contactName: 'Luca Bianchi' },
    { id: 'cust-5', name: 'Harbour View Restaurant', type: 'restaurant', address: '100 Harbour St, Sydney', phone: '+61 2 7777 2222', email: 'reservations@harbourview.com.au', contactName: 'Sarah Chen' },

    // Hotels
    { id: 'cust-6', name: 'Harbour View Hotel', type: 'hotel', address: '789 Harbour St, Sydney', phone: '+61 2 5555 1234', email: 'reservations@harbourview.com.au', contactName: 'David Brown' },
    { id: 'cust-7', name: 'Bondi Beach Hotel', type: 'hotel', address: '456 Bondi Rd, Bondi', phone: '+61 2 8888 9999', email: 'frontdesk@bondibeachhotel.com.au', contactName: 'Emma Davis' },
    { id: 'cust-8', name: 'Sydney Central Hotel', type: 'hotel', address: '321 Pitt St, Sydney', phone: '+61 2 4444 5555', email: 'concierge@sydneycentral.com.au', contactName: 'James Wilson' },

    // Cafes
    { id: 'cust-9', name: 'Corner Cafe', type: 'cafe', address: '123 Oxford St, Paddington', phone: '+61 2 3333 6666', email: 'hello@cornercafe.com.au', contactName: 'Anna Taylor' },
    { id: 'cust-10', name: 'Beachside Cafe', type: 'cafe', address: '789 Marine Pde, Manly', phone: '+61 2 2222 7777', email: 'info@beachsidecafe.com.au', contactName: 'Tom Anderson' },
    { id: 'cust-11', name: 'Urban Grind', type: 'cafe', address: '456 Victoria St, Kings Cross', phone: '+61 2 1111 3333', email: 'orders@urbangrind.com.au', contactName: 'Lisa Park' },
  ];

  console.log('👥 Creating customers...');
  for (const customerData of customers) {
    await prisma.customer.upsert({
      where: { id: customerData.id },
      update: {},
      create: customerData,
    });
  }

  // Seed categories and items
  console.log('📦 Creating categories and items...');
  for (let cIdx = 0; cIdx < categories.length; cIdx++) {
    const c = categories[cIdx];
    const category = await prisma.category.upsert({
      where: { name: c.name },
      update: { sortOrder: cIdx },
      create: { name: c.name, sortOrder: cIdx },
    });
    for (let iIdx = 0; iIdx < c.items.length; iIdx++) {
      const i = c.items[iIdx];
      const parsed = parseTarget(i.targetText);
      await prisma.item.upsert({
        where: { name: i.name },
        update: {
          categoryId: category.id,
          targetText: i.targetText,
          targetNumber: parsed.targetNumber,
          unit: parsed.unit,
          sortOrder: iIdx,
        },
        create: {
          name: i.name,
          categoryId: category.id,
          targetText: i.targetText,
          targetNumber: parsed.targetNumber,
          unit: parsed.unit,
          sortOrder: iIdx,
        },
      });
    }
  }

  // Create sample stocktakes for the last 30 days (reduced if LIGHT_SEED)
  console.log('📊 Creating sample stocktakes...');
  const allStores = await prisma.store.findMany();
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@stocktake.com' } });
  const allItems = await prisma.item.findMany({
    include: { category: true }
  });

  const stocktakeDays = LIGHT_SEED ? 7 : 30;
  for (let i = 0; i < stocktakeDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Create stocktakes for random stores
  const storesToStocktake = allStores.filter(() => Math.random() > (LIGHT_SEED ? 0.85 : 0.7)); // fewer in light mode

    for (const store of storesToStocktake) {
  if (LIGHT_SEED) await new Promise(r => setTimeout(r, 10));
  const stocktake = await prisma.stocktake.create({
        data: ({
          storeId: store.id,
          date: date,
          submittedAt: new Date(date.getTime() + Math.random() * 8 * 60 * 60 * 1000), // Random time during the day
          ...(adminUser ? { submittedByUserId: adminUser.id } : {}),
          items: {
            create: allItems
              .filter(() => Math.random() > (LIGHT_SEED ? 0.6 : 0.3)) // fewer items in light mode
              .map((item: any) => ({
                itemId: item.id,
                quantity: item.category.name === 'Gelato Flavors'
                  ? Math.floor(Math.random() * 3) + 1 // 1-3 tubs for gelato
                  : Math.floor(Math.random() * 10) + 1, // 1-10 for other items
              }))
          }
        }) as any
      });
    }
  }

  // Create sample delivery plans (past week) and some upcoming (next two weeks)
  console.log('🚚 Creating sample delivery plans...');
  const allCustomers = await prisma.customer.findMany();
  const gelatoItems = await prisma.item.findMany({
    where: { category: { name: 'Gelato Flavors' } }
  });

  const pastDeliveryCount = LIGHT_SEED ? 8 : 15;
  for (let i = 0; i < pastDeliveryCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Last 7 days

    // Randomly choose between store delivery or customer delivery
    const isStoreDelivery = Math.random() > 0.6; // 40% store deliveries, 60% customer deliveries

    let deliveryPlanData: any = {
      date: date,
      status: ['DRAFT', 'CONFIRMED', 'SENT'][Math.floor(Math.random() * 3)] as 'DRAFT' | 'CONFIRMED' | 'SENT',
      items: {
        create: gelatoItems
          .filter(() => Math.random() > 0.4) // 60% chance of including each flavor
          .slice(0, Math.floor(Math.random() * 5) + 1) // 1-5 flavors per delivery
          .map((item: any) => ({
            itemId: item.id,
            quantity: Math.floor(Math.random() * 3) + 1, // 1-3 tubs
          }))
      }
    };

    if (isStoreDelivery) {
      deliveryPlanData.storeId = allStores[Math.floor(Math.random() * allStores.length)].id;
    } else {
      const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
      deliveryPlanData.customers = {
        create: {
          customerId: customer.id,
          priority: Math.floor(Math.random() * 5) + 1,
        }
      };
    }

  // Simple retry to avoid transient DB disconnects during heavy seed
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
    if (LIGHT_SEED) await new Promise(r => setTimeout(r, 25));
        await prisma.deliveryPlan.create({ data: deliveryPlanData });
        break;
      } catch (err: any) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 250 * attempt));
      }
    }
  }

  // Upcoming deliveries (next 14 days) to ensure production planning/analytics have data
  const futureDeliveryCount = LIGHT_SEED ? 6 : 12;
  for (let i = 0; i < futureDeliveryCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 14) + 1); // Next 1-14 days

    const isStoreDelivery = Math.random() > 0.6;
    let deliveryPlanData: any = {
      date: date,
      status: ['DRAFT', 'CONFIRMED'][Math.floor(Math.random() * 2)] as 'DRAFT' | 'CONFIRMED',
      items: {
        create: gelatoItems
          .filter(() => Math.random() > 0.4)
          .slice(0, Math.floor(Math.random() * 5) + 1)
          .map((item: any) => ({
            itemId: item.id,
            quantity: Math.floor(Math.random() * 3) + 1,
          }))
      }
    };

    if (isStoreDelivery) {
      deliveryPlanData.storeId = allStores[Math.floor(Math.random() * allStores.length)].id;
    } else {
      const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
      deliveryPlanData.customers = {
        create: {
          customerId: customer.id,
          priority: Math.floor(Math.random() * 5) + 1,
        }
      };
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (LIGHT_SEED) await new Promise(r => setTimeout(r, 25));
        await prisma.deliveryPlan.create({ data: deliveryPlanData });
        break;
      } catch (err: any) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 250 * attempt));
      }
    }
  }

  // Create sample suppliers
  console.log('🏪 Creating suppliers...');
  const suppliers = [
    { id: 'sup-1', name: 'Premium Dairy Co', contactName: 'John Smith', email: 'orders@premiumdairy.com', phone: '+61 2 1234 5678', address: '123 Dairy Rd, Sydney NSW 2000' },
    { id: 'sup-2', name: 'Sweet Ingredients Ltd', contactName: 'Sarah Johnson', email: 'sales@sweetingredients.com.au', phone: '+61 2 8765 4321', address: '456 Sugar Lane, Parramatta NSW 2150' },
    { id: 'sup-3', name: 'Fresh Fruit Distributors', contactName: 'Mike Chen', email: 'mike@freshfruit.com.au', phone: '+61 2 5555 1234', address: '789 Fruit Market, Alexandria NSW 2015' },
    { id: 'sup-4', name: 'Packaging Solutions', contactName: 'Lisa Brown', email: 'lisa@packagingsolutions.com.au', phone: '+61 2 4444 5678', address: '321 Package St, Botany NSW 2019' },
    { id: 'sup-5', name: 'Equipment & Supplies Co', contactName: 'David Wilson', email: 'david@equipment.com.au', phone: '+61 2 3333 9999', address: '654 Equipment Ave, North Sydney NSW 2060' },
  ];

  for (const supplierData of suppliers) {
    await prisma.supplier.upsert({
      where: { id: supplierData.id },
      update: {},
      create: supplierData,
    });
  }


  // Create sample recipes
  console.log('👨‍🍳 Creating recipes...');
  const recipes = [
    {
      name: 'Classic Vanilla',
      description: 'Traditional vanilla gelato with Madagascar vanilla beans',
      category: 'gelato',
      ingredients: [
        { itemName: 'Fior De Latte 5l', quantity: 4.5, unit: 'l' },
        { itemName: 'Sugar sachets (white)', quantity: 500, unit: 'g' },
        { itemName: 'Milk', quantity: 0.5, unit: 'l' },
        { itemName: 'Vanilla Extract', quantity: 15, unit: 'ml' },
      ]
    },
    {
      name: 'Rich Chocolate',
      description: 'Decadent dark chocolate gelato',
      category: 'gelato',
      ingredients: [
        { itemName: 'Fior De Latte 5l', quantity: 4.0, unit: 'l' },
        { itemName: 'Sugar sachets (white)', quantity: 400, unit: 'g' },
        { itemName: 'Milk', quantity: 1.0, unit: 'l' },
        { itemName: 'Cocoa Powder', quantity: 200, unit: 'g' },
      ]
    },
    {
      name: 'Strawberry Delight',
      description: 'Fresh strawberry gelato with real fruit',
      category: 'gelato',
      ingredients: [
        { itemName: 'Fior De Latte 5l', quantity: 3.5, unit: 'l' },
        { itemName: 'Sugar sachets (white)', quantity: 350, unit: 'g' },
        { itemName: 'Milk', quantity: 1.5, unit: 'l' },
        { itemName: 'Strawberry', quantity: 800, unit: 'g' },
      ]
    },
    {
      name: 'Lemon Sorbet',
      description: 'Refreshing lemon sorbet, dairy-free',
      category: 'sorbet',
      ingredients: [
        { itemName: 'Sugar sachets (white)', quantity: 600, unit: 'g' },
        { itemName: 'Lemon', quantity: 1.2, unit: 'kg' },
        { itemName: 'Sparkling Water', quantity: 1.0, unit: 'l' },
      ]
    },
  ];

  for (const recipeData of recipes) {
    // Find the items for this recipe
    const ingredientItems = [];
    for (const ing of recipeData.ingredients) {
      const item = await prisma.item.findFirst({
        where: { name: ing.itemName }
      });
      if (item) {
        ingredientItems.push({
          itemId: item.id,
          quantity: ing.quantity,
          unit: ing.unit
        });
      }
    }

    if (ingredientItems.length > 0) {
      await prisma.recipe.upsert({
        where: { name: recipeData.name },
        update: {},
        create: {
          name: recipeData.name,
          description: recipeData.description,
          category: recipeData.category,
          ingredients: {
            create: ingredientItems
          }
        },
      });
    }
  }

  console.log('✅ Database seeding completed successfully!');
  console.log(`📊 Summary:`);
  console.log(`   - ${stores.length} stores created`);
  console.log(`   - ${customers.length} customers created`);
  console.log(`   - ${categories.length} categories with ${categories.reduce((sum, cat) => sum + cat.items.length, 0)} items`);
  console.log(`   - ${suppliers.length} suppliers created`);
  console.log(`   - ${recipes.length} recipes created`);
  console.log(`   - Sample stocktakes and delivery plans created`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
