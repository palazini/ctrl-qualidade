// src/components/layout/CompanyHeader.tsx
import {
  Group,
  Stack,
  Text,
  Avatar,
  Box,
  Menu,
  Divider,
  Image,
} from '@mantine/core';
import {
  IconChevronDown,
  IconLogout,
  IconBuildingFactory2,
  IconUserCircle,          // <- novo
} from '@tabler/icons-react';

type CompanyHeaderProps = {
  companyName: string;
  appUserName: string;
  userEmail: string;
  hasMultipleCompanies: boolean;
  onChangeCompany: () => void;
  onLogout: () => void;
  onGoProfile: () => void;        // <- NOVO

  // opcional: logo da companhia (URL pública)
  companyLogoUrl?: string | null;
};

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getUserInitials(name: string, email: string) {
  if (name?.trim()) return getInitials(name);
  if (!email) return '?';
  const beforeAt = email.split('@')[0];
  return beforeAt.slice(0, 2).toUpperCase();
}

export function CompanyHeader({
  companyName,
  appUserName,
  userEmail,
  hasMultipleCompanies,
  onChangeCompany,
  onLogout,
  onGoProfile,           // <- NOVO
  companyLogoUrl,
}: CompanyHeaderProps) {
  const companyLogoNode = companyLogoUrl ? (
    <Box
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      <Image
        src={companyLogoUrl}
        alt={companyName}
        fit="contain"
        width="100%"
        height="100%"
      />
    </Box>
  ) : (
    <Avatar radius="xl" size={40} variant="filled">
      {getInitials(companyName)}
    </Avatar>
  );

  return (
    <Group
      h={72}
      px="lg"
      justify="space-between"
      style={{
        borderBottom: '1px solid #edf0f5',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Lado esquerdo: logo + infos da companhia / produto */}
      <Group gap="sm">
        {companyLogoNode}

        <Stack gap={2}>
          <Text fw={600} size="sm">
            Portal de Documentos
          </Text>
          <Text size="xs" c="dimmed">
            {companyName}
          </Text>
        </Stack>
      </Group>

      {/* Lado direito: menu do usuário */}
      <Menu position="bottom-end" width={260} shadow="md" withinPortal>
        <Menu.Target>
          <Group gap={6} style={{ cursor: 'pointer' }}>
            <Avatar radius="xl" size={32} color="blue">
              {getUserInitials(appUserName, userEmail)}
            </Avatar>
            <IconChevronDown size={14} />
          </Group>
        </Menu.Target>

        <Menu.Dropdown>
          <Box px="sm" py="xs">
            <Text size="sm" fw={500}>
              {appUserName || 'Usuário'}
            </Text>
            {userEmail && (
              <Text size="xs" c="dimmed">
                {userEmail}
              </Text>
            )}
          </Box>

          <Divider my="xs" />

          {/* Meu perfil */}
          <Menu.Item
            leftSection={<IconUserCircle size={14} />}
            onClick={onGoProfile}
          >
            Meu perfil
          </Menu.Item>

          {hasMultipleCompanies && (
            <Menu.Item
              leftSection={<IconBuildingFactory2 size={14} />}
              onClick={onChangeCompany}
            >
              Trocar companhia
            </Menu.Item>
          )}

          <Divider my="xs" />

          <Menu.Item
            leftSection={<IconLogout size={14} />}
            color="red"
            onClick={onLogout}
          >
            Sair
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
