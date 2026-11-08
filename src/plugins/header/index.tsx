'use client';

import { Flex, Text } from '@radix-ui/themes';
import { useNamespaceList } from '../../hooks/use-orcher-api';
import { useGlobalNamespace } from '../../contexts/namespace-context';
import { SearchableSelect } from '../../components/searchable-select';

export function GlobalNamespaceSelector() {
  const { globalNamespace, setGlobalNamespace } = useGlobalNamespace();
  const { namespaces } = useNamespaceList();

  return (
    <Flex align="center" gap="2">
      <SearchableSelect
        value={globalNamespace}
        onChange={setGlobalNamespace}
        placeholder="All Namespaces"
        searchPlaceholder="Search namespaces..."
        width={160}
        options={[
          { value: 'all', label: 'All Namespaces' },
          ...namespaces
            .filter((ns) => ns.status === 'active')
            .map((ns) => ({ value: ns.name, label: ns.name })),
        ]}
      />
    </Flex>
  );
}
