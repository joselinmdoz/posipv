"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dec = dec;
exports.decToMoney = decToMoney;
exports.moneyEq = moneyEq;
const client_1 = require("@prisma/client");
function dec(value) {
    if (value instanceof client_1.Prisma.Decimal)
        return value;
    return new client_1.Prisma.Decimal(value);
}
function decToMoney(d) {
    return d.toFixed(2);
}
function moneyEq(a, b) {
    return a.toFixed(2) === b.toFixed(2);
}
//# sourceMappingURL=decimal.js.map