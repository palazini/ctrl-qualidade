// src/pages/company/CompanyLayoutPage.tsx
import { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  AppShell,
  Center,
  Loader,
  Card,
  Stack,
  Text,
  Group,
  Burger,
} from '@mantine/core';
import {
  useParams,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { CompanyHeader } from '../../components/layout/CompanyHeader';
import {
  CompanySidebar,
  type CompanyView,
} from '../../components/layout/CompanySidebar';

type Company = { id: string; name: string; slug: string };

type UserCompanyRole = 'COLABORADOR' | 'PUBLICADOR' | 'GESTOR_QUALIDADE';

type UserCompany = {
  id: string;
  role: UserCompanyRole;
  is_default: boolean;
  company: Company;
};

type AppUser = {
  id: string;
  full_name: string;
  system_role: 'NORMAL' | 'SITE_ADMIN';
};

export type CompanyOutletContext = {
  company: Company;
  currentRole: UserCompanyRole;
  appUser: AppUser;
  userEmail: string;
};

export default function CompanyLayoutPage() {
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? '';

  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [memberships, setMemberships] = useState<UserCompany[]>([]);
  const [error, setError] = useState<string | null>(null);

  // controla abrir/fechar navbar no mobile
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] =
    useDisclosure(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setAppUser(null);
      setMemberships([]);
      setError('Usuário não autenticado.');
      return;
    }
    if (!slug) {
      setLoading(false);
      setError('Companhia não especificada na rota.');
      return;
    }

    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const { data: appUserData, error: appUserError } = await supabase
        .from('app_users')
        .select('id, full_name, system_role')
        .eq('id', userId)
        .maybeSingle<AppUser>();

      if (!isMounted) return;

      if (appUserError) {
        console.error(appUserError);
        setError('Erro ao carregar dados do usuário de aplicação.');
        setLoading(false);
        return;
      }

      if (!appUserData) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      setAppUser(appUserData);

      const { data: membershipsData, error: membershipsError } =
        await supabase
          .from('user_companies')
          .select(
            `
          id,
          role,
          is_default,
          company:companies (
            id,
            name,
            slug
          )
        `,
          )
          .eq('user_id', userId);

      if (!isMounted) return;

      if (membershipsError) {
        console.error(membershipsError);
        setError('Erro ao carregar companhias vinculadas ao usuário.');
        setLoading(false);
        return;
      }

      const parsed: UserCompany[] =
        (membershipsData as any)?.map((m: any) => ({
          id: m.id,
          role: m.role as UserCompanyRole,
          is_default: m.is_default,
          company: {
            id: m.company.id,
            name: m.company.name,
            slug: m.company.slug,
          },
        })) ?? [];

      setMemberships(parsed);
      setLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, slug]);

  const currentMembership = useMemo(() => {
    if (!slug) return undefined;
    return memberships.find((m) => m.company.slug === slug);
  }, [memberships, slug]);

  const hasMultipleCompanies = memberships.length > 1;

  // view ativa para pintar a sidebar (profile não entra aqui de propósito)
  const activeView: CompanyView = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';

    if (last === 'publisher') return 'publisher';
    if (last === 'quality') return 'quality';
    if (last === 'quality-published') return 'qualityPublished';
    if (last === 'quality-archived') return 'qualityArchived';
    if (last === 'doc-types') return 'docTypes';
    if (last === 'admin') return 'admin';
    // se estiver em /profile, vai cair em 'library' (ok)
    return 'library';
  }, [location.pathname]);

  function handleLogout() {
    supabase.auth.signOut();
  }

  // helper pra montar a URL do logo (public/company-logos/<slug>.png)
  function getCompanyLogoUrl() {
    if (!currentMembership) return undefined;
    return `/company-logos/${currentMembership.company.slug}.png`;
  }

  function renderCentered(main: ReactNode) {
    return (
      <AppShell header={{ height: 72 }} padding="md">
        <AppShell.Header>
          <CompanyHeader
            companyName={
              currentMembership?.company.name ?? 'Portal de Documentos'
            }
            appUserName={appUser?.full_name ?? ''}
            userEmail={userEmail}
            hasMultipleCompanies={hasMultipleCompanies}
            onChangeCompany={() => navigate('/', { replace: true })}
            onLogout={handleLogout}
            onGoProfile={() => navigate('profile')}
            companyLogoUrl={getCompanyLogoUrl()}
          />
        </AppShell.Header>
        <AppShell.Main>
          <Center h="calc(100vh - 72px)">{main}</Center>
        </AppShell.Main>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Estados de erro / loading / sem acesso
  // ---------------------------------------------------------------------------

  if (!userId) {
    return renderCentered(
      <Card withBorder shadow="sm" radius="md" maw={480} mx="auto">
        <Stack gap="xs">
          <Text fw={600}>Sessão não encontrada</Text>
          <Text size="sm" c="dimmed">
            Não foi possível encontrar a sessão do usuário. Tente fazer login
            novamente.
          </Text>
        </Stack>
      </Card>,
    );
  }

  if (!slug) {
    return renderCentered(
      <Card withBorder shadow="sm" radius="md" maw={480} mx="auto">
        <Stack gap="xs">
          <Text fw={600}>Companhia não especificada</Text>
          <Text size="sm" c="dimmed">
            A rota não informa qual companhia deve ser acessada.
          </Text>
        </Stack>
      </Card>,
    );
  }

  if (loading) {
    return renderCentered(<Loader size="lg" />);
  }

  if (error) {
    return renderCentered(
      <Card withBorder shadow="sm" radius="md" maw={480} mx="auto">
        <Stack gap="xs">
          <Text fw={600}>Não foi possível carregar os dados</Text>
          <Text size="sm" c="dimmed">
            {error}
          </Text>
        </Stack>
      </Card>,
    );
  }

  if (!appUser) {
    return renderCentered(
      <Card withBorder shadow="sm" radius="md" maw={480} mx="auto">
        <Stack gap="xs">
          <Text fw={600}>Usuário não configurado</Text>
          <Text size="sm" c="dimmed">
            Seu e-mail está autenticado, mas ainda não existe um cadastro de
            usuário de aplicação vinculado no sistema.
          </Text>
        </Stack>
      </Card>,
    );
  }

  if (!currentMembership) {
    return renderCentered(
      <Card withBorder shadow="sm" radius="md" maw={480} mx="auto">
        <Stack gap="xs">
          <Text fw={600}>Acesso não autorizado</Text>
          <Text size="sm" c="dimmed">
            Seu usuário não possui acesso à companhia{' '}
            <Text span fw={500}>
              {slug}
            </Text>
            .
          </Text>
        </Stack>
      </Card>,
    );
  }

  // ---------------------------------------------------------------------------
  // Layout principal
  // ---------------------------------------------------------------------------

  const currentRole = currentMembership.role;
  const canSeePublisher =
    currentRole === 'PUBLICADOR' || currentRole === 'GESTOR_QUALIDADE';
  const canSeeQuality = currentRole === 'GESTOR_QUALIDADE';
  const canSeeAdmin = appUser.system_role === 'SITE_ADMIN';

  const handleChangeView = (view: CompanyView) => {
    // ao trocar de view no mobile, fecha o navbar
    closeNavbar();

    switch (view) {
      case 'library':
        navigate('library');
        break;
      case 'publisher':
        navigate('publisher');
        break;
      case 'quality':
        navigate('quality');
        break;
      case 'qualityPublished':
        navigate('quality-published');
        break;
      case 'qualityArchived':
        navigate('quality-archived');
        break;
      case 'docTypes':
        navigate('doc-types');
        break;
      case 'admin':
        navigate('admin');
        break;
      default:
        navigate('library');
    }
  };

  const outletContext: CompanyOutletContext = {
    company: currentMembership.company,
    currentRole,
    appUser,
    userEmail,
  };

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !navbarOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <CompanyHeader
            companyName={currentMembership.company.name}
            appUserName={appUser.full_name}
            userEmail={userEmail}
            hasMultipleCompanies={hasMultipleCompanies}
            onChangeCompany={() => navigate('/', { replace: true })}
            onLogout={handleLogout}
            onGoProfile={() => navigate('profile')}
            companyLogoUrl={getCompanyLogoUrl()}
          />

          <Burger
            opened={navbarOpened}
            onClick={toggleNavbar}
            hiddenFrom="sm"
            size="sm"
            aria-label="Abrir menu"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <CompanySidebar
          activeView={activeView}
          onChangeView={handleChangeView}
          canSeePublisher={canSeePublisher}
          canSeeQuality={canSeeQuality}
          canSeeAdmin={canSeeAdmin}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet context={outletContext} />
      </AppShell.Main>
    </AppShell>
  );
}
