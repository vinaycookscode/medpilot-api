import { UserRole } from '../../users/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  clinicId: string;
  firstName: string;
  lastName: string;
  iat?: number;
  exp?: number;
}
