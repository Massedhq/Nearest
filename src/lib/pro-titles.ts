/** What students call the professionals in each category — used in "No lash artists in this area yet". */
const TITLES: Record<string, string> = {
  "Hair": "hair stylists",
  "Braids": "braiders",
  "Locs": "loctitians",
  "Barber": "barbers",
  "Lashes": "lash artists",
  "Brows": "brow artists",
  "Nails": "nail techs",
  "Makeup": "makeup artists",
  "Photography": "photographers",
  "Skincare": "estheticians",
  "Hair Removal": "waxing & sugaring specialists",
  "Massage": "massage therapists",
  "Body & Wellness": "body & wellness professionals",
  "Tattoos & Piercings": "tattoo artists & piercers",
  "Fitness": "trainers & instructors",
  "Personal Styling": "stylists",
  "Grooming": "grooming specialists",
};

/** "lash artists" for Lashes; a category added later in Admin falls back to "<name> professionals". */
export const proTitle = (category: string | null | undefined) =>
  category ? TITLES[category] ?? `${category.toLowerCase()} professionals` : "professionals";
