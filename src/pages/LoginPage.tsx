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
} from '@mantine/core';
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

  return (
    <Box
      h="100vh"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at top left, #f1f3f5 0, #f8f9fa 40%, #e7f5ff 100%)',
      }}
    >
      <Container size="lg">
        <Paper
          withBorder
          shadow="xl"
          radius="lg"
          p={0}
          style={{
            overflow: 'hidden',
            maxWidth: 900,
            margin: '0 auto',
            borderColor: '#dde1e7',
          }}
        >
          <Group gap={0} align="stretch" grow wrap="wrap">
            {/* Lado esquerdo: apenas logo */}
            <Box
              style={{
                flex: 1,
                minWidth: 260,
                padding: '28px 32px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRight: '1px solid #edf0f5',
              }}
            >
              {/* Área central só com a marca */}
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

              {/* Rodapé discreto */}
              <Stack gap={2} mt="lg">
                <Text size="xs" c="dimmed">
                  Desenvolvido pela Melhoria Contínua.
                </Text>
                <Text size="xs" c="dimmed">
                  © {new Date().getFullYear()} MC Controle.
                </Text>
              </Stack>
            </Box>

            {/* Lado direito: formulário */}
            <Box
              style={{
                flex: 1.1,
                minWidth: 430,
                padding: '32px',
                background:
                  'linear-gradient(135deg, #f8f9fb 0%, #f1f3f5 40%, #e7f5ff 100%)',
              }}
            >
              <Stack gap="sm" maw={360} ml="auto">
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

                    <Button
                      type="submit"
                      loading={submitting}
                      fullWidth
                      mt="sm"
                    >
                      Entrar
                    </Button>
                  </Stack>
                </form>
              </Stack>
            </Box>
          </Group>
        </Paper>
      </Container>
    </Box>
  );
}
