import { useParams } from 'react-router';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { MenuOptionsPage } from './menu-options-page';
import { RoleDetailPage } from './role-detail-page';
import { RolesPage } from './roles-page';
import { UserDetail } from './user-detail';
import { UsersList } from './users-list';

// Pantallas de seguridad tal como las monta el router (cada una en su archivo diferido).

export function InstitutionRolesRoute() {
  return <RolesPage scope="institution" />;
}

export function InstitutionRoleRoute() {
  return <RoleDetailPage scope="institution" />;
}

export function GlobalRolesRoute() {
  return <RolesPage scope="global" />;
}

export function GlobalRoleRoute() {
  return <RoleDetailPage scope="global" />;
}

export function MenuOptionsRoute() {
  return <MenuOptionsPage editable={false} />;
}

export function AdminMenuOptionsRoute() {
  return <MenuOptionsPage editable />;
}

/** /security/users: usuarios de la institución activa. */
export function UsersRoute() {
  const can = usePermissions('security.users');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Las personas que entran a Aula360 en esta institución y sus roles."
      />
      <UsersList
        scope={{ kind: 'institution' }}
        detailPath={(id) => `/security/users/${encodeURIComponent(id)}`}
        canCreate={can.create}
      />
    </div>
  );
}

export function UserRoute() {
  const { id = '' } = useParams();
  return (
    <UserDetail
      scope={{ kind: 'institution' }}
      id={id}
      back={{ to: '/security/users', label: 'Usuarios' }}
    />
  );
}

/** /admin/institutions/:institutionId/users/:id (SUPER_ADMIN). */
export function InstitutionUserRoute() {
  const { institutionId = '', id = '' } = useParams();
  return (
    <UserDetail
      scope={{ kind: 'system', institutionId }}
      id={id}
      back={{
        to: `/admin/institutions/${encodeURIComponent(institutionId)}?tab=users`,
        label: 'Usuarios de la institución',
      }}
    />
  );
}
