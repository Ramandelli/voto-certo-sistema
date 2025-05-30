import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  loginWithEmail, 
  loginWithGoogle,
  linkGoogleWithEmail
} from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, LogIn } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [pendingGoogleInfo, setPendingGoogleInfo] = useState<{email: string} | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Função para obter mensagem de erro amigável com base no código de erro
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-credential':
        return "Credenciais inválidas. Verifique seu e-mail e senha e tente novamente. Se você se cadastrou com Google, tente fazer login com Google.";
      case 'auth/user-not-found':
        return "Usuário não encontrado. Verifique seu e-mail ou cadastre-se.";
      case 'auth/wrong-password':
        return "Senha incorreta. Tente novamente ou clique em 'Esqueceu a senha?'.";
      case 'auth/too-many-requests':
        return "Muitas tentativas de login malsucedidas. Tente novamente mais tarde ou redefina sua senha.";
      case 'auth/user-disabled':
        return "Esta conta foi desativada. Entre em contato com o suporte para obter ajuda.";
      case 'auth/unauthorized-domain':
        const currentDomain = window.location.hostname;
        return `O domínio atual "${currentDomain}" não está autorizado no Firebase. 
        
ATENÇÃO: Verifique se você adicionou EXATAMENTE este domínio nas configurações do Firebase. 

Observe a diferença entre .app e .com no final do domínio.`;
      default:
        return "Erro ao fazer login. Por favor, tente novamente.";
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo ao sistema de pesquisas eleitorais.",
      });
      navigate('/');
    } catch (error: any) {
      console.error(error);
      
      // Tratamento de erro melhorado
      const errorMessage = getErrorMessage(error.code);
      setAuthError(errorMessage);
      
      toast({
        title: "Erro ao fazer login",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();
      
      // Se o login for bem-sucedido, redireciona para a página inicial
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo ao sistema de pesquisas eleitorais.",
      });
      navigate('/');
      
    } catch (error: any) {
      console.error(error);
      
      // Se for erro de conta já existente com mesmo e-mail
      if (error.code === 'auth/account-exists-with-different-credential') {
        setPendingGoogleInfo({ email: error.customData?.email || '' });
        setEmail(error.customData?.email || '');
        setShowLinkDialog(true);
      } 
      // Mensagem de erro personalizada para qualquer erro
      else {
        const errorMessage = getErrorMessage(error.code);
        setAuthError(errorMessage);
        
        toast({
          title: "Erro ao fazer login com Google",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkAccounts = async () => {
    if (!pendingGoogleInfo || !pendingGoogleInfo.email || !linkPassword) {
      toast({
        title: "Informações incompletas",
        description: "Por favor, forneça sua senha para vincular as contas.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await linkGoogleWithEmail(pendingGoogleInfo.email, linkPassword);
      
      setShowLinkDialog(false);
      toast({
        title: "Contas vinculadas com sucesso",
        description: "Agora você pode acessar com e-mail/senha ou Google.",
      });
      navigate('/');
    } catch (error: any) {
      console.error(error);
      
      // Tratamento de erro melhorado para vinculação de contas
      const errorMessage = getErrorMessage(error.code);
      
      toast({
        title: "Erro ao vincular contas",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-gradient">Login</CardTitle>
        <CardDescription className="text-center">
          Acesse a plataforma de pesquisas eleitorais
        </CardDescription>
      </CardHeader>
      <CardContent>
        {authError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erro de autenticação</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {authError}
            </AlertDescription>
          </Alert>
        )}
      
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <a 
                href="/forgot-password" 
                className="text-sm text-primary hover:underline"
              >
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Carregando..." : "Entrar"}
          </Button>
        </form>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Ou continue com
            </span>
          </div>
        </div>
        
        <div className="grid gap-3">
          <Button 
            variant="outline" 
            type="button" 
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-center text-sm">
          Ainda não tem uma conta?{" "}
          <a 
            href="/register" 
            className="text-primary hover:underline font-medium"
          >
            Cadastre-se
          </a>
        </div>
      </CardFooter>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular contas</DialogTitle>
            <DialogDescription>
              Já existe uma conta com o e-mail {pendingGoogleInfo?.email}. 
              Digite sua senha para vincular sua conta do Google a esta conta existente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="link-password">Senha da conta existente</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="link-password"
                  type="password"
                  placeholder="********"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancelar</Button>
            <Button onClick={handleLinkAccounts} disabled={isLoading}>
              {isLoading ? "Processando..." : "Vincular contas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LoginForm;
