"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    const adminEmail = "admin@pos.local";
    const adminPass = "Admin123!";
    const passwordHash = await bcrypt.hash(adminPass, 10);
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            passwordHash,
            role: client_1.Role.ADMIN,
        },
    });
    console.log("✅ Seed listo.");
    console.log("Admin:", adminEmail, "Pass:", adminPass);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => prisma.$disconnect());
//# sourceMappingURL=seed.js.map