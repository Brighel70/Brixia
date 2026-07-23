import { supabase } from '@/lib/supabaseClient'

type ProfileLike = {
  id: string
  person_id?: string | null
}

/**
 * people.id da usare in match_lists.created_by.
 * La policy INSERT exige created_by = get_my_person_id() (= profiles.person_id).
 */
export async function resolveMatchListCreatedBy(profile: ProfileLike | null): Promise<string | null> {
  if (!profile?.id) return null

  if (profile.person_id) return profile.person_id

  try {
    const { data: freshProfile, error } = await supabase
      .from('profiles')
      .select('person_id')
      .eq('id', profile.id)
      .maybeSingle()

    if (error) {
      console.warn('resolveMatchListCreatedBy: errore lettura profiles', error)
      return null
    }

    return freshProfile?.person_id ?? null
  } catch (err) {
    console.warn('resolveMatchListCreatedBy: eccezione', err)
    return null
  }
}

