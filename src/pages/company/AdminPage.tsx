// src/pages/company/AdminPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Card,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Loader,
  Center,
  ScrollArea,
  TextInput,
  Select,
  Divider,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconUser,
  IconBuildingFactory2,
  IconTrash,
  IconReload,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

type SystemRole = 'NORMAL' | 'SITE_ADMIN';
type CompanyRole = 'COLABORADOR' | 'PUBLICADOR' | 'GESTOR_QUALIDADE';

type AdminUser = {
  id: string;
  full_name: string;
  email: string | null;
  system_role: SystemRole;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
};

type AdminMembership = {
  id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  role: CompanyRole;
  is_default: boolean;
};

type EditingUser = {
  id: string | null; // null = novo
  full_name: string;
  email: string;
  system_role: SystemRole;
};

export default function AdminPage() {
  const { appUser } = useOutletContext<CompanyOutletContext>();

  // Segurança extra: se não for SITE_ADMIN, mostra mensagem
  const isSiteAdmin = appUser.system_role === 'SITE_ADMIN';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  const [savingUser, setSavingUser] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);

  // campos de "novo vínculo"
  const [newCompanyId, setNewCompanyId] = useState<string | null>(null);
  const [newCompanyRole, setNewCompanyRole] =
    useState<CompanyRole | null>('COLABORADOR');
  const [newCompanyDefault, setNewCompanyDefault] = useState(false);

  // ---------------------------------------------------------------------------
  // Carregar usuários e companhias
  // ---------------------------------------------------------------------------

  async function loadUsers() {
    setLoadingUsers(true);
    setErrorUsers(null);
    const { data, error } = await supabase
      .from('app_users')
      .select('id, full_name, email, system_role')
      .order('full_name', { ascending: true });

    if (error) {
      console.error(error);
      setErrorUsers('Erro ao carregar usuários de aplicação.');
      setLoadingUsers(false);
      return;
    }

    const rows = (data ?? []) as any[];

    const mapped: AdminUser[] = rows.map((u) => ({
      id: u.id as string,
      full_name: u.full_name as string,
      email: (u.email as string) ?? null,
      system_role: (u.system_role as SystemRole) ?? 'NORMAL',
    }));

    setUsers(mapped);
    setLoadingUsers(false);
  }

  async function loadCompanies() {
    setLoadingCompanies(true);
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, slug')
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setLoadingCompanies(false);
      return;
    }

    const rows = (data ?? []) as any[];
    const mapped: CompanyRow[] = rows.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      slug: c.slug as string,
    }));

    setCompanies(mapped);
    setLoadingCompanies(false);
  }

  useEffect(() => {
    if (!isSiteAdmin) return;
    loadUsers();
    loadCompanies();
  }, [isSiteAdmin]);

  // ---------------------------------------------------------------------------
  // Carregar vínculos de um usuário
  // ---------------------------------------------------------------------------

  async function loadMemberships(userId: string) {
    setLoadingMemberships(true);

    const { data, error } = await supabase
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

    if (error) {
      console.error(error);
      setMemberships([]);
      setLoadingMemberships(false);
      return;
    }

    const rows = (data ?? []) as any[];

    const mapped: AdminMembership[] = rows.map((m) => ({
      id: m.id as string,
      company_id: m.company.id as string,
      company_name: m.company.name as string,
      company_slug: m.company.slug as string,
      role: m.role as CompanyRole,
      is_default: !!m.is_default,
    }));

    setMemberships(mapped);
    setLoadingMemberships(false);
  }

  // ---------------------------------------------------------------------------
  // Seleção de usuário / novo usuário
  // ---------------------------------------------------------------------------

  function handleSelectUser(user: AdminUser) {
    setSelectedUserId(user.id);
    setEditingUser({
      id: user.id,
      full_name: user.full_name,
      email: user.email ?? '',
      system_role: user.system_role,
    });
    setNewCompanyId(null);
    setNewCompanyRole('COLABORADOR');
    setNewCompanyDefault(false);
    loadMemberships(user.id);
  }

  function handleNewUser() {
    setSelectedUserId(null);
    setEditingUser({
      id: null,
      full_name: '',
      email: '',
      system_role: 'NORMAL',
    });
    setMemberships([]);
    setNewCompanyId(null);
    setNewCompanyRole('COLABORADOR');
    setNewCompanyDefault(false);
  }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const haystack = `${u.full_name} ${u.email ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [users, search]);

  // ---------------------------------------------------------------------------
  // Salvar usuário (criar / atualizar)
  // ---------------------------------------------------------------------------

  async function handleSaveUser() {
    if (!editingUser) return;

    const email = editingUser.email.trim().toLowerCase();
    const name = editingUser.full_name.trim();

    if (!email || !name) {
      alert('Preencha o nome completo e o e-mail.');
      return;
    }

    setSavingUser(true);

    try {
      // NOVO USUÁRIO
      if (!editingUser.id) {
        // 1) Buscar id no auth.users pela função RPC
        const { data: authUserId, error: rpcError } = await supabase.rpc(
          'find_auth_user_id_by_email',
          { p_email: email }
        );

        if (rpcError) {
          console.error(rpcError);
          throw new Error(
            'Erro ao consultar usuário no Auth. Verifique a função find_auth_user_id_by_email.'
          );
        }

        if (!authUserId) {
          throw new Error(
            'Nenhum usuário encontrado no Auth com esse e-mail. Cadastre primeiro o e-mail no Supabase Auth.'
          );
        }

        // 2) Criar app_user
        const { data: insertData, error: insertError } = await supabase
          .from('app_users')
          .insert({
            id: authUserId,
            full_name: name,
            email,
            system_role: editingUser.system_role,
          })
          .select('id')
          .single();

        if (insertError || !insertData) {
          console.error(insertError);
          throw new Error('Falha ao criar usuário de aplicação.');
        }

        // Recarrega lista e seleciona o novo
        await loadUsers();
        const newId = insertData.id as string;
        const created = users.find((u) => u.id === newId);
        // melhor recarregar memberships em branco
        setSelectedUserId(newId);
        setEditingUser({
          ...editingUser,
          id: newId,
        });
        setMemberships([]);
      } else {
        // USUÁRIO EXISTENTE
        const { error: updateError } = await supabase
          .from('app_users')
          .update({
            full_name: name,
            email,
            system_role: editingUser.system_role,
          })
          .eq('id', editingUser.id);

        if (updateError) {
          console.error(updateError);
          throw new Error('Falha ao atualizar usuário de aplicação.');
        }

        await loadUsers();
      }

      alert('Usuário salvo com sucesso.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSavingUser(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Operações em memberships
  // ---------------------------------------------------------------------------

  async function handleAddMembership() {
    if (!editingUser || !editingUser.id) {
      alert('Salve o usuário antes de adicionar companhias.');
      return;
    }
    if (!newCompanyId || !newCompanyRole) {
      alert('Selecione a companhia e o papel.');
      return;
    }

    setSavingMembership(true);

    try {
      // se for default, zera os outros defaults
      if (newCompanyDefault) {
        await supabase
          .from('user_companies')
          .update({ is_default: false })
          .eq('user_id', editingUser.id);
      }

      const { error: insertError } = await supabase.from('user_companies').insert({
        user_id: editingUser.id,
        company_id: newCompanyId,
        role: newCompanyRole,
        is_default: newCompanyDefault,
      });

      if (insertError) {
        console.error(insertError);
        throw new Error('Falha ao adicionar vínculo com companhia.');
      }

      await loadMemberships(editingUser.id);
      setNewCompanyId(null);
      setNewCompanyRole('COLABORADOR');
      setNewCompanyDefault(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao adicionar vínculo.');
    } finally {
      setSavingMembership(false);
    }
  }

  async function handleChangeMembershipRole(
    membershipId: string,
    newRole: CompanyRole
  ) {
    if (!editingUser || !editingUser.id) return;

    setSavingMembership(true);
    try {
      const { error } = await supabase
        .from('user_companies')
        .update({ role: newRole })
        .eq('id', membershipId);

      if (error) {
        console.error(error);
        throw new Error('Falha ao atualizar papel na companhia.');
      }

      await loadMemberships(editingUser.id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao atualizar papel.');
    } finally {
      setSavingMembership(false);
    }
  }

  async function handleSetDefaultMembership(membershipId: string) {
    if (!editingUser || !editingUser.id) return;

    setSavingMembership(true);
    try {
      // zera todos
      await supabase
        .from('user_companies')
        .update({ is_default: false })
        .eq('user_id', editingUser.id);

      // seta o selecionado
      const { error } = await supabase
        .from('user_companies')
        .update({ is_default: true })
        .eq('id', membershipId);

      if (error) {
        console.error(error);
        throw new Error('Falha ao definir companhia padrão.');
      }

      await loadMemberships(editingUser.id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao definir padrão.');
    } finally {
      setSavingMembership(false);
    }
  }

  async function handleRemoveMembership(membershipId: string) {
    if (!editingUser || !editingUser.id) return;

    const confirmed = window.confirm(
      'Remover esse acesso de companhia do usuário?'
    );
    if (!confirmed) return;

    setSavingMembership(true);
    try {
      const { error } = await supabase
        .from('user_companies')
        .delete()
        .eq('id', membershipId);

      if (error) {
        console.error(error);
        throw new Error('Falha ao remover vínculo com companhia.');
      }

      await loadMemberships(editingUser.id);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao remover vínculo.');
    } finally {
      setSavingMembership(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Guard extra: não-admin vê aviso
  // ---------------------------------------------------------------------------

  if (!isSiteAdmin) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={600}>Acesso restrito</Text>
          <Text size="sm" c="dimmed">
            Apenas usuários com papel{' '}
            <Text span fw={600}>
              SITE_ADMIN
            </Text>{' '}
            podem acessar a administração do portal.
          </Text>
        </Stack>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Layout da página
  // ---------------------------------------------------------------------------

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={500}>Administração do portal</Text>
            <Text size="sm" c="dimmed">
              Gestão de usuários e acessos por companhia.
            </Text>
          </Stack>
          <Button
            variant="subtle"
            radius="xl"
            size="xs"
            leftSection={<IconReload size={14} />}
            onClick={() => {
              loadUsers();
              if (editingUser?.id) {
                loadMemberships(editingUser.id);
              }
            }}
          >
            Recarregar
          </Button>
        </Group>

        <Group align="flex-start" grow>
          {/* COLUNA ESQUERDA – LISTA DE USUÁRIOS */}
          <Card withBorder radius="md" shadow="xs" style={{ width: 320 }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500} size="sm">
                  Usuários de aplicação
                </Text>
                <Badge variant="light" color="blue">
                  {users.length}
                </Badge>
              </Group>

              <TextInput
                placeholder="Buscar por nome ou e-mail"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                size="xs"
              />

              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleNewUser}
                variant="light"
              >
                Novo usuário
              </Button>

              <Divider my="xs" />

              {loadingUsers ? (
                <Center h={200}>
                  <Loader size="sm" />
                </Center>
              ) : errorUsers ? (
                <Text size="xs" c="red">
                  {errorUsers}
                </Text>
              ) : users.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Nenhum usuário cadastrado.
                </Text>
              ) : (
                <ScrollArea h={320} type="always">
                  <Stack gap="xs" pr="xs">
                    {filteredUsers.map((u) => {
                      const isActive = u.id === selectedUserId;
                      return (
                        <Card
                          key={u.id}
                          withBorder
                          radius="md"
                          shadow={isActive ? 'sm' : 'xs'}
                          onClick={() => handleSelectUser(u)}
                          style={{
                            cursor: 'pointer',
                            borderColor: isActive ? '#228be6' : undefined,
                            backgroundColor: isActive ? '#f5f9ff' : undefined,
                          }}
                        >
                          <Group align="flex-start" justify="space-between">
                            <Group gap="xs">
                              <IconUser size={16} />
                              <Stack gap={0}>
                                <Text fw={500} size="sm">
                                  {u.full_name}
                                </Text>
                                {u.email && (
                                  <Text size="xs" c="dimmed">
                                    {u.email}
                                  </Text>
                                )}
                              </Stack>
                            </Group>
                            <Badge
                              size="xs"
                              color={
                                u.system_role === 'SITE_ADMIN'
                                  ? 'grape'
                                  : 'gray'
                              }
                              variant="light"
                            >
                              {u.system_role === 'SITE_ADMIN'
                                ? 'Admin'
                                : 'Normal'}
                            </Badge>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              )}
            </Stack>
          </Card>

          {/* COLUNA DIREITA – DETALHES DO USUÁRIO */}
          <Card withBorder radius="md" shadow="xs" style={{ flex: 1 }}>
            {!editingUser ? (
              <Center h={320}>
                <Text size="sm" c="dimmed">
                  Selecione um usuário à esquerda ou clique em{' '}
                  <Text span fw={500}>
                    Novo usuário
                  </Text>
                  .
                </Text>
              </Center>
            ) : (
              <Stack gap="md">
                {/* DADOS DO USUÁRIO */}
                <Stack gap={4}>
                  <Text fw={500} size="sm">
                    Dados do usuário
                  </Text>
                  <Text size="xs" c="dimmed">
                    Informe o e-mail já cadastrado no Supabase Auth e o nome
                    completo. O e-mail será usado também para exibição interna.
                  </Text>
                </Stack>

                <Group grow align="flex-end">
                  <TextInput
                    label="E-mail (Auth)"
                    placeholder="usuario@empresa.com"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        email: e.currentTarget.value,
                      })
                    }
                    size="xs"
                  />
                  <TextInput
                    label="Nome completo"
                    placeholder="Nome do colaborador"
                    value={editingUser.full_name}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        full_name: e.currentTarget.value,
                      })
                    }
                    size="xs"
                  />
                  <Select
                    label="Papel global"
                    data={[
                      { value: 'NORMAL', label: 'Normal' },
                      { value: 'SITE_ADMIN', label: 'Admin do site' },
                    ]}
                    value={editingUser.system_role}
                    onChange={(value) =>
                      setEditingUser({
                        ...editingUser,
                        system_role: (value as SystemRole) ?? 'NORMAL',
                      })
                    }
                    size="xs"
                  />
                </Group>

                <Group justify="flex-end">
                  <Button
                    size="xs"
                    onClick={handleSaveUser}
                    loading={savingUser}
                  >
                    Salvar usuário
                  </Button>
                </Group>

                <Divider my="xs" />

                {/* VÍNCULOS POR COMPANHIA */}
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <IconBuildingFactory2 size={16} />
                      <Text fw={500} size="sm">
                        Acessos por companhia
                      </Text>
                    </Group>
                  </Group>

                  {loadingMemberships ? (
                    <Center h={120}>
                      <Loader size="sm" />
                    </Center>
                  ) : memberships.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Nenhuma companhia vinculada a este usuário.
                    </Text>
                  ) : (
                    <Stack gap={4}>
                      {memberships.map((m) => (
                        <Card
                          key={m.id}
                          withBorder
                          radius="md"
                          shadow="xs"
                          padding="xs"
                        >
                          <Group justify="space-between" align="center">
                            <Stack gap={0}>
                              <Text fw={500} size="sm">
                                {m.company_name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                slug: {m.company_slug}
                              </Text>
                            </Stack>
                            <Group gap="xs" align="center">
                              <Select
                                size="xs"
                                data={[
                                  {
                                    value: 'COLABORADOR',
                                    label: 'Colaborador',
                                  },
                                  {
                                    value: 'PUBLICADOR',
                                    label: 'Publicador',
                                  },
                                  {
                                    value: 'GESTOR_QUALIDADE',
                                    label: 'Gestor Qualidade',
                                  },
                                ]}
                                value={m.role}
                                onChange={(value) =>
                                  value &&
                                  handleChangeMembershipRole(
                                    m.id,
                                    value as CompanyRole
                                  )
                                }
                              />
                              <Button
                                size="xs"
                                variant={m.is_default ? 'filled' : 'light'}
                                color={m.is_default ? 'blue' : 'gray'}
                                onClick={() =>
                                  handleSetDefaultMembership(m.id)
                                }
                              >
                                {m.is_default
                                  ? 'Padrão'
                                  : 'Definir como padrão'}
                              </Button>
                              <Button
                                size="xs"
                                color="red"
                                variant="subtle"
                                onClick={() => handleRemoveMembership(m.id)}
                                leftSection={<IconTrash size={14} />}
                              >
                                Remover
                              </Button>
                            </Group>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}

                  <Divider my="xs" />

                  {/* ADICIONAR VÍNCULO */}
                  <Stack gap="xs">
                    <Text fw={500} size="sm">
                      Adicionar acesso
                    </Text>
                    <Group grow align="flex-end">
                      <Select
                        label="Companhia"
                        placeholder={
                          loadingCompanies
                            ? 'Carregando...'
                            : 'Selecione a companhia'
                        }
                        data={companies.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                        value={newCompanyId}
                        onChange={setNewCompanyId}
                        size="xs"
                      />
                      <Select
                        label="Papel"
                        data={[
                          {
                            value: 'COLABORADOR',
                            label: 'Colaborador',
                          },
                          {
                            value: 'PUBLICADOR',
                            label: 'Publicador',
                          },
                          {
                            value: 'GESTOR_QUALIDADE',
                            label: 'Gestor Qualidade',
                          },
                        ]}
                        value={newCompanyRole}
                        onChange={(value) =>
                          setNewCompanyRole(
                            (value as CompanyRole) ?? 'COLABORADOR'
                          )
                        }
                        size="xs"
                      />
                      <Select
                        label="Padrão?"
                        data={[
                          { value: 'no', label: 'Não' },
                          { value: 'yes', label: 'Sim' },
                        ]}
                        value={newCompanyDefault ? 'yes' : 'no'}
                        onChange={(value) =>
                          setNewCompanyDefault(value === 'yes')
                        }
                        size="xs"
                      />
                      <Button
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={handleAddMembership}
                        loading={savingMembership}
                      >
                        Adicionar
                      </Button>
                    </Group>
                  </Stack>
                </Stack>
              </Stack>
            )}
          </Card>
        </Group>
      </Stack>
    </Card>
  );
}
