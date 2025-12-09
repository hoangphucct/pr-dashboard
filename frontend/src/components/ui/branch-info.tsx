'use client';

interface BranchInfoProps {
  baseBranch?: string;
  headBranch?: string;
}

export function BranchInfo({ baseBranch, headBranch }: BranchInfoProps) {
  if (!baseBranch && !headBranch) {
    return null;
  }

  return (
    <div className="mt-1 text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded break-all">
      {baseBranch || 'unknown'} ← {headBranch || 'unknown'}
    </div>
  );
}
