// src/pages/company/ProfilePage.tsx
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Card,
  Stack,
  Text,
  Group,
  TextInput,
  PasswordInput,
  Button,
  Divider,
  Badge,
} from '@mantine/core';
import {
  IconUserCircle,
  IconLock,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';
import { notifications } from '@mantine/notifications';

type SystemRole = 'NORMAL' | 'SITE_ADMIN';
type CompanyRole = 'COLABORADOR' | 'PUBLICADOR' | 'GESTOR_QUALIDADE';

function systemRoleLabel(role: SystemRole | null | undefined) {
  if (role === 'SITE_ADMIN') return 'Administrador do site';
  return 'Usuário normal';
}

function companyRoleLabel(role: CompanyRole | null | undefined) {
  switch (role) {
    case 'GESTOR_QUALIDADE':
      return 'Gestor de Qualidade';
    case 'PUBLICADOR':
      return 'Publicador';
    case 'COLABORADOR':
      return 'Colaborador';
    default:
      return 'Sem papel definido';
  }
}

export default function ProfilePage() {
  const { appUser, currentRole, company, userEmail } =
    useOutletContext<CompanyOutletContext>();

  const [fullName, setFullName] = useState(appUser.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile() {
    const name = fullName.trim();

    if (!name) {
      notifications.show({
        color: 'red',
        title: 'Nome inválido',
        message: 'Informe um nome para exibição.',
      });
      return;
    }

    setSavingProfile(true);

    try {
      // 1) Atualiza na tabela de app_users
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ full_name: name })
        .eq('id', appUser.id);

      if (updateError) {
        console.error(updateError);
        throw new Error('Falha ao atualizar os dados de perfil.');
      }

      // 2) (opcional) Atualiza metadata no Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: name },
      });

      if (authError) {
        console.error(authError);
        // não travo por causa disso, só aviso no log
      }

      notifications.show({
        color: 'green',
        title: 'Perfil atualizado',
        message: 'Seu nome foi atualizado com sucesso.',
      });
    } catch (err: any) {
      console.error(err);
      notifications.show({
        color: 'red',
        title: 'Erro ao salvar',
        message: err.message || 'Não foi possível salvar seu perfil.',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      notifications.show({
        color: 'red',
        title: 'Senha atual',
        message: 'Informe sua senha atual.',
      });
      return;
    }

    if (newPassword.length < 8) {
      notifications.show({
        color: 'red',
        title: 'Nova senha fraca',
        message: 'A nova senha deve ter pelo menos 8 caracteres.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      notifications.show({
        color: 'red',
        title: 'Confirmação inválida',
        message: 'A confirmação de senha não confere com a nova senha.',
      });
      return;
    }

    setSavingPassword(true);

    try {
      // 1) Garante e-mail do usuário logado
      const { data: userData, error: getUserError } =
        await supabase.auth.getUser();

      if (getUserError || !userData.user?.email) {
        console.error(getUserError);
        throw new Error(
          'Não foi possível obter o usuário autenticado. Tente fazer login novamente.'
        );
      }

      const email = userData.user.email;

      // 2) Reautentica com a senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        console.error(signInError);
        throw new Error('Senha atual incorreta.');
      }

      // 3) Atualiza a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error(updateError);
        throw new Error('Falha ao atualizar a senha.');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      notifications.show({
        color: 'green',
        title: 'Senha alterada',
        message: 'Sua senha foi atualizada com sucesso.',
      });
    } catch (err: any) {
      console.error(err);
      notifications.show({
        color: 'red',
        title: 'Erro ao alterar senha',
        message: err.message || 'Não foi possível alterar sua senha.',
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="md">
        {/* Cabeçalho */}
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={500}>Meu perfil</Text>
            <Text size="sm" c="dimmed">
              Ajuste suas informações pessoais e senha de acesso.
            </Text>
          </Stack>

          <Stack gap={4} align="flex-end">
            <Badge
              size="xs"
              variant="light"
              color={appUser.system_role === 'SITE_ADMIN' ? 'grape' : 'gray'}
            >
              {systemRoleLabel(appUser.system_role as SystemRole)}
            </Badge>
            {company && (
              <Badge
                size="xs"
                variant="light"
                color={currentRole === 'GESTOR_QUALIDADE' ? 'teal' : 'blue'}
              >
                {company.name} · {companyRoleLabel(currentRole as CompanyRole)}
              </Badge>
            )}
          </Stack>
        </Group>

        <Divider />

        {/* Dados básicos */}
        <Stack gap="xs">
          <Group gap="xs">
            <IconUserCircle size={18} />
            <Text fw={500} size="sm">
              Informações gerais
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            O e-mail é o mesmo usado para autenticação no portal. O nome é usado
            em telas internas e históricos.
          </Text>

          <Group grow align="flex-end">
            <TextInput
              label="E-mail"
              value={userEmail}
              readOnly
              size="xs"
            />
            <TextInput
              label="Nome para exibição"
              placeholder="Seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
              size="xs"
            />
          </Group>

          <Group justify="flex-end" mt="xs">
            <Button
              size="xs"
              onClick={handleSaveProfile}
              loading={savingProfile}
            >
              Salvar perfil
            </Button>
          </Group>
        </Stack>

        <Divider my="sm" />

        {/* Alterar senha */}
        <Stack gap="xs">
          <Group gap="xs">
            <IconLock size={18} />
            <Text fw={500} size="sm">
              Alterar senha
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Por segurança, você precisa informar a senha atual para definir uma
            nova senha.
          </Text>

          <Group grow align="flex-end">
            <PasswordInput
              label="Senha atual"
              placeholder="Digite sua senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
              size="xs"
            />
          </Group>

          <Group grow align="flex-end">
            <PasswordInput
              label="Nova senha"
              placeholder="Mínimo de 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              size="xs"
            />
            <PasswordInput
              label="Confirmar nova senha"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              size="xs"
            />
          </Group>

          <Group justify="flex-end" mt="xs">
            <Button
              size="xs"
              variant="outline"
              onClick={handleChangePassword}
              loading={savingPassword}
            >
              Atualizar senha
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Card>
  );
}
