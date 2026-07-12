import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail, isStrongEnoughPassword } from '@/lib/utils/validation';

type AccountType = 'contractor' | 'architect' | 'pm_gc' | 'other';

const ROLE_MAP: Record<AccountType, 'contractor' | 'architect' | 'customer'> = {
  contractor: 'contractor',
  architect: 'architect',
  pm_gc: 'customer',
  other: 'customer',
};

interface RegisterRequestBody {
  email: string;
  password: string;
  fullName: string;
  company?: string;
  accountType: AccountType;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<RegisterRequestBody>;
    const { email, password, fullName, company, accountType } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!password || !isStrongEnoughPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include a number or symbol.' },
        { status: 400 }
      );
    }
    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 });
    }
    if (!accountType || !(accountType in ROLE_MAP)) {
      return NextResponse.json({ error: 'Select a valid account type.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    });

    if (signUpError || !signUpData.user) {
      return NextResponse.json(
        { error: signUpError?.message ?? 'Registration failed. Please try again.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error: profileError } = await admin.from('profiles').insert({
      id: signUpData.user.id,
      email,
      full_name: fullName,
      company: company || null,
      role: ROLE_MAP[accountType],
    });

    if (profileError) {
      console.error('[Register API] Profile insert failed', profileError);
      return NextResponse.json(
        { error: 'Account created but profile setup failed. Contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Register API Error]', error);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
