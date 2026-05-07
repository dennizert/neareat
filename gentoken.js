require('dotenv').config();
const {signToken} = require('./src/utils/jwt');
const prisma = require('./src/utils/prisma');
prisma.user.findFirst().then(u => {
  if (u) console.log(signToken(u.id));
  return prisma.$disconnect();
}).catch(e => console.error(e.message));
