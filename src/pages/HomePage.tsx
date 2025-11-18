import { useEffect, useState } from 'react';
import {
  Center,
  Loader,
  Card,
  Stack,
  Text,
  SimpleGrid,
  Group,
  Badge,
  Button,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';

type Company = {
  id: string;
  name: string;
  slug: string;
};

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

function RoleBadge({ role }: { role: UserCompanyRole }) {
  const labelMap: Record<UserCompanyRole, string> = {
    COLABORADOR: 'Colaborador',
    PUBLICADOR: 'Publicador',
    GESTOR_QUALIDADE: 'Gestor de Qualidade',
  };

  const colorMap: Record<UserCompanyRole, string> = {
    COLABORADOR: 'gray',
    PUBLICADOR: 'indigo',
    GESTOR_QUALIDADE: 'teal',
  };

  return (
    <Badge color={colorMap[role]} variant="light">
      {labelMap[role]}
    </Badge>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? '';

  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [memberships, setMemberships] = useState<UserCompany[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setAppUser(null);
      setMemberships([]);
      setError('Usuário não autenticado.');
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

      const { data: membershipsData, error: membershipsError } = await supabase
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
        `
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

      // Se só tiver uma companhia, já redireciona direto pra ela
      if (parsed.length === 1) {
        const only = parsed[0];
        navigate(`/company/${only.company.slug}/library`, { replace: true });
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, navigate]);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!userId) {
    return (
      <Center h="100vh">
        <Card withBorder shadow="sm" radius="md" maw={480}>
          <Stack gap="xs">
            <Text fw={600}>Sessão não encontrada</Text>
            <Text size="sm" c="dimmed">
              Não foi possível encontrar a sessão do usuário. Tente fazer login
              novamente.
            </Text>
          </Stack>
        </Card>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Card withBorder shadow="sm" radius="md" maw={480}>
          <Stack gap="xs">
            <Text fw={600}>Erro ao carregar dados</Text>
            <Text size="sm" c="dimmed">
              {error}
            </Text>
          </Stack>
        </Card>
      </Center>
    );
  }

  if (!appUser) {
    return (
      <Center h="100vh">
        <Card withBorder shadow="sm" radius="md" maw={480}>
          <Stack gap="xs">
            <Text fw={600}>Usuário não configurado</Text>
            <Text size="sm" c="dimmed">
              Seu e-mail está autenticado, mas ainda não existe um cadastro
              de usuário de aplicação vinculado no sistema.
            </Text>
          </Stack>
        </Card>
      </Center>
    );
  }

  if (memberships.length === 0) {
    return (
      <Center h="100vh">
        <Card withBorder shadow="sm" radius="md" maw={480}>
          <Stack gap="xs">
            <Text fw={600}>Nenhuma companhia vinculada</Text>
            <Text size="sm" c="dimmed">
              Seu usuário está configurado, mas ainda não há companhias
              associadas a ele.
            </Text>
          </Stack>
        </Card>
      </Center>
    );
  }

  // Se chegou aqui, tem 2+ companhias → seleção
  return (
    <Center h="100vh">
      <Card withBorder shadow="sm" radius="md" maw={720} w="100%" p="lg">
        <Stack gap="md">
          <Stack gap={2}>
            <Text fw={600}>Bem-vindo ao Portal de Documentos</Text>
            <Text size="sm" c="dimmed">
              Usuário: {appUser.full_name} ({userEmail})
            </Text>
            <Text size="sm" c="dimmed">
              Selecione abaixo a companhia que deseja acessar.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {memberships.map((m) => (
              <Card
                key={m.id}
                withBorder
                shadow="xs"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  navigate(`/company/${m.company.slug}/library`)
                }
              >
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600}>{m.company.name}</Text>
                    <RoleBadge role={m.role} />
                  </Group>
                  <Text size="xs" c="dimmed">
                    Acesso como{' '}
                    <Text span fw={500}>
                      {m.role === 'COLABORADOR'
                        ? 'Colaborador'
                        : m.role === 'PUBLICADOR'
                        ? 'Publicador'
                        : 'Gestor de Qualidade'}
                    </Text>
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          <Button
            variant="subtle"
            size="xs"
            onClick={() => supabase.auth.signOut()}
            mt="sm"
            style={{ alignSelf: 'flex-end' }}
          >
            Sair
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
