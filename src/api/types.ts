import type { components } from './schema';

type Schemas = components['schemas'];

export type Session = Schemas['SessionResponseDto'];
export type SessionUser = Schemas['SessionUserDto'];
export type Membership = Schemas['InstitutionMembershipDto'];
export type UserType = SessionUser['userType'];
export type MenuNode = Schemas['MyMenuNodeDto'];
export type MenuPermissions = Schemas['MenuNodePermissionsDto'];
export type Profile = Schemas['ProfileUserDto'];
