// src/pages/LoginPage.tsx
import { useState } from 'react';
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Anchor,
  Container,
  Alert,
  Image,
  Box,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabaseClient';
import { IconAlertCircle } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';

const EMAIL_DOMAIN = 'mc.controle.com';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation() as any;

  const from = location.state?.from?.pathname || '/';

  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  function buildEmail(value: string) {
    const raw = value.trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    return `${raw}@${EMAIL_DOMAIN}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const finalEmail = buildEmail(identifier);

    if (!finalEmail) {
      setErrorMsg('Informe seu usuário ou e-mail.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: finalEmail,
      password,
    });

    setSubmitting(false);

    if (error) {
      console.error(error);
      setErrorMsg('Usuário/e-mail ou senha inválidos.');
      return;
    }

    notifications.show({
      title: 'Login realizado',
      message: 'Bem-vindo de volta!',
    });

    if (data.session) {
      navigate(from, { replace: true });
    }
  }

  const year = new Date().getFullYear();

  // Corpo comum do formulário (usado tanto no mobile quanto no desktop)
  const formBody = (
    <>
      <Stack gap={2}>
        <Text size="xs" c="dimmed" fw={600} tt="uppercase">
          Acesso
        </Text>
        <Title order={3}>Entrar no portal</Title>
        <Text size="sm" c="dimmed">
          Use seu usuário e senha.
        </Text>
      </Stack>

      {errorMsg && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Erro ao entrar"
          color="red"
        >
          {errorMsg}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Usuário ou e-mail"
            placeholder={`joao.silva ou joao.silva@${EMAIL_DOMAIN}`}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.currentTarget.value)}
          />

          <PasswordInput
            label="Senha"
            placeholder="Sua senha"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />

          <Group justify="space-between" mt="xs">
            <Anchor size="xs" c="dimmed">
              Esqueceu a senha? Procure o responsável de Melhoria Contínua.
            </Anchor>
          </Group>

          <Button type="submit" loading={submitting} fullWidth mt="sm">
            Entrar
          </Button>
        </Stack>
      </form>
    </>
  );

  return (
    <Box
      h="100vh"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at top left, #f1f3f5 0, #f8f9fa 40%, #e7f5ff 100%)',
        padding: isMobile ? '16px' : 0,
      }}
    >
      <Container size={isMobile ? 'xs' : 'lg'} px={0}>
        <Paper
          withBorder
          shadow="xl"
          radius="lg"
          p={0}
          style={{
            overflow: 'hidden',
            maxWidth: isMobile ? 420 : 900,
            margin: '0 auto',
            borderColor: '#dde1e7',
          }}
        >
          {isMobile ? (
            // ==========================
            // LAYOUT MOBILE (uma coluna)
            // ==========================
            <Box
              style={{
                padding: '24px 20px 16px',
                background:
                  'linear-gradient(135deg, #f8f9fb 0%, #f1f3f5 40%, #e7f5ff 100%)',
              }}
            >
              <Stack gap="lg">
                <Stack gap="xs" align="center">
                  <Image
                    src="/company-logos/mc-logo.png"
                    alt="Programa de Melhoria Contínua"
                    mah={80}
                    fit="contain"
                    fallbackSrc=""
                  />
                </Stack>

                <Stack gap="sm" maw={360} mx="auto">
                  {formBody}
                </Stack>

                <Stack gap={2} mt="sm" align="center">
                  <Text size="xs" c="dimmed">
                    Desenvolvido pela Melhoria Contínua.
                  </Text>
                  <Text size="xs" c="dimmed">
                    © {year} MC Controle.
                  </Text>
                </Stack>
              </Stack>
            </Box>
          ) : (
            // ==========================
            // LAYOUT DESKTOP (dois lados)
            // ==========================
            <Group gap={0} align="stretch" grow wrap="nowrap">
              {/* Lado esquerdo: logo e rodapé */}
              <Box
                style={{
                  flex: 1,
                  padding: '28px 32px',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRight: '1px solid #edf0f5',
                }}
              >
                <Stack
                  gap="lg"
                  justify="center"
                  align="flex-start"
                  style={{ flex: 1 }}
                >
                  <Image
                    src="/company-logos/mc-logo.png"
                    alt="Programa de Melhoria Contínua"
                    mah={110}
                    fit="contain"
                    fallbackSrc=""
                  />
                </Stack>

                <Stack gap={2} mt="lg">
                  <Text size="xs" c="dimmed">
                    Desenvolvido pela Melhoria Contínua.
                  </Text>
                  <Text size="xs" c="dimmed">
                    © {year} MC Controle.
                  </Text>
                </Stack>
              </Box>

              {/* Lado direito: formulário */}
              <Box
                style={{
                  flex: 1.1,
                  padding: '32px',
                  background:
                    'linear-gradient(135deg, #f8f9fb 0%, #f1f3f5 40%, #e7f5ff 100%)',
                }}
              >
                <Stack gap="sm" maw={360} ml="auto">
                  {formBody}
                </Stack>
              </Box>
            </Group>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
