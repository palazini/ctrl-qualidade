// src/components/layout/CompanySidebar.tsx
import type { ReactNode } from 'react';
import {
  Stack,
  Text,
  UnstyledButton,
  Group,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconBook,
  IconSend,
  IconShieldCheck,
  IconFolders,
  IconArchive,
  IconCategory2,
  IconSettings,
} from '@tabler/icons-react';

export type CompanyView =
  | 'library'
  | 'publisher'
  | 'quality'
  | 'qualityPublished'
  | 'qualityArchived'
  | 'docTypes'
  | 'admin';

type CompanySidebarProps = {
  activeView: CompanyView;
  onChangeView: (view: CompanyView) => void;
  canSeePublisher: boolean;
  canSeeQuality: boolean;
  canSeeAdmin: boolean;
};

type NavItemProps = {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

function NavItem({ active, label, icon, onClick }: NavItemProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        borderLeft: active ? '3px solid #228be6' : '3px solid transparent',
        backgroundColor: active ? '#f4f8ff' : 'transparent',
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
    >
      <Group gap="xs" align="center">
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
          }}
        >
          {icon}
        </Box>
        <Text size="sm" fw={active ? 600 : 500}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

export function CompanySidebar({
  activeView,
  onChangeView,
  canSeePublisher,
  canSeeQuality,
  canSeeAdmin,
}: CompanySidebarProps) {
  return (
    <Stack gap="md" style={{ paddingRight: 8 }}>
      {/* Bloco: Documentos gerais */}
      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Documentos
        </Text>

        <NavItem
          active={activeView === 'library'}
          label="Biblioteca"
          icon={<IconBook size={16} />}
          onClick={() => onChangeView('library')}
        />
      </Stack>

      <Divider />

      {/* Bloco: Fluxo de trabalho */}
      {(canSeePublisher || canSeeQuality) && (
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Fluxo de trabalho
          </Text>

          {canSeePublisher && (
            <NavItem
              active={activeView === 'publisher'}
              label="Publicar documentos"
              icon={<IconSend size={16} />}
              onClick={() => onChangeView('publisher')}
            />
          )}

          {canSeeQuality && (
            <>
              <NavItem
                active={activeView === 'quality'}
                label="Revisar documentos"
                icon={<IconShieldCheck size={16} />}
                onClick={() => onChangeView('quality')}
              />

              <NavItem
                active={activeView === 'qualityPublished'}
                label="Documentos publicados"
                icon={<IconFolders size={16} />}
                onClick={() => onChangeView('qualityPublished')}
              />

              <NavItem
                active={activeView === 'qualityArchived'}
                label="Arquivados"
                icon={<IconArchive size={16} />}
                onClick={() => onChangeView('qualityArchived')}
              />

              <NavItem
                active={activeView === 'docTypes'}
                label="Tipos de documento"
                icon={<IconCategory2 size={16} />}
                onClick={() => onChangeView('docTypes')}
              />
            </>
          )}
        </Stack>
      )}

      {/* Bloco: Administração */}
      {canSeeAdmin && (
        <>
          <Divider />
          <Stack gap={6}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Administração
            </Text>

            <NavItem
              active={activeView === 'admin'}
              label="Administração do site"
              icon={<IconSettings size={16} />}
              onClick={() => onChangeView('admin')}
            />
          </Stack>
        </>
      )}
    </Stack>
  );
}
