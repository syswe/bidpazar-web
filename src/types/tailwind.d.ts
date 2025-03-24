// This file ensures TypeScript recognizes Tailwind CSS classes in string literals
declare module "tailwindcss" {
  const tailwindcss: unknown;
  export = tailwindcss;
}

// For CSS modules
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

// For global CSS imports
declare module "*.css" {
  const content: unknown;
  export default content;
}

declare module "*.scss" {
  const content: unknown;
  export default content;
}
