import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SignInPageProps = {
    searchParams: Promise<{ callbackUrl?: string }>;
};

async function signInWithGitHub(formData: FormData) {
    'use server';
    const callbackUrl = (formData.get('callbackUrl') as string) || '/dashboard';
    await signIn('github', { redirectTo: callbackUrl });
}

async function signInWithGoogle(formData: FormData) {
    'use server';
    const callbackUrl = (formData.get('callbackUrl') as string) || '/dashboard';
    await signIn('google', { redirectTo: callbackUrl });
}

export default async function SignInPage(props: SignInPageProps) {
    const { callbackUrl = '/dashboard' } = await props.searchParams;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Sign in to Finances</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <form action={signInWithGitHub}>
                        <input
                            type="hidden"
                            name="callbackUrl"
                            value={callbackUrl}
                        />
                        <Button type="submit" className="w-full" size="lg">
                            Continue with GitHub
                        </Button>
                    </form>
                    <form action={signInWithGoogle}>
                        <input
                            type="hidden"
                            name="callbackUrl"
                            value={callbackUrl}
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            className="w-full"
                            size="lg"
                        >
                            Continue with Google
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
