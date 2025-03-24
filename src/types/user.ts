export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  updatedAt: string;
}
