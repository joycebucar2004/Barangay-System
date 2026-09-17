export function generateTempPassword({ firstName, lastName, dateOfBirth }) {
  const namePart = `${(firstName || "").slice(0, 2)}${(lastName || "").slice(0, 2)}`.replace(/[^a-zA-Z]/g, "") || "brgy";
  const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  const yearPart = dateOfBirth ? String(dateOfBirth).slice(2, 4) : String(new Date().getFullYear()).slice(2, 4);
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${capitalized}${yearPart}${randomDigits}!`;
}
