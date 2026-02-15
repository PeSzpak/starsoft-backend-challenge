export enum AppRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export type AuthUser = {
  id: string;
  role: AppRole;
};

