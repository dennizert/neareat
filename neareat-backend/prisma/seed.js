const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REWARDS = [
  {
    name: 'Yeni Kaşif',
    description: 'NearEat ailesine hoş geldin! İlk adımını attın.',
    requiredStars: 0,
    type: 'BADGE',
    icon: '🌱',
    sortOrder: 1,
  },
  {
    name: 'Gastronomi Meraklısı',
    description: '10 yıldıza ulaştın. Lezzet dünyasına adım atıyorsun!',
    requiredStars: 10,
    type: 'BADGE',
    icon: '🍽️',
    sortOrder: 2,
  },
  {
    name: 'Restoran Uzmanı',
    description: '25 yıldızla artık bir uzmansın. Özel profil rozeti kazandın!',
    requiredStars: 25,
    type: 'BADGE',
    icon: '🏆',
    sortOrder: 3,
  },
  {
    name: 'NearEat Elçisi',
    description: '50 yıldıza ulaştın! 1 aylık ücretsiz Premium üyelik hediye edildi.',
    requiredStars: 50,
    type: 'GIFT',
    icon: '⭐',
    sortOrder: 4,
  },
  {
    name: 'Gastronomi Efsanesi',
    description: '100 yıldız! Partner restoranlarda %15 indirim hakkı kazandın.',
    requiredStars: 100,
    type: 'GIFT',
    icon: '👑',
    sortOrder: 5,
  },
];

async function main() {
  console.log('Seeding rewards...');
  await prisma.reward.deleteMany();
  await prisma.reward.createMany({ data: REWARDS });
  console.log(`✓ ${REWARDS.length} reward seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
