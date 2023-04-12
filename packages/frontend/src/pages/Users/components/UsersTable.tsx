import React from 'react';
import { useRecoilValue, useRecoilState, atom } from 'recoil';
import {
  AllAdminUsers,
  AllForwarderUsers,
  AllQuantifierUsers,
  AllUsers,
  roleOptions,
} from '@/model/user/users';
import { SearchInput } from '@/components/form/SearchInput';
import { SelectInput } from '@/components/form/SelectInput';
import { UsersTableRow } from './UsersTableRow';
import { UsersTablePagination } from './UsersTablePagination';
import { User } from '@/model/user/dto/user.dto';
import { UserRole } from '@/model/user/enums/user-role.enum';

const USERS_PER_PAGE = 10;

interface roleOptionsProps {
  value: string;
  label: string;
}

const UsersTableData = atom<User[] | undefined>({
  key: 'UsersTableData',
  default: undefined,
});

const UsersTableSelectedRole = atom<roleOptionsProps>({
  key: 'UsersTableSelectedRole',
  default: roleOptions[0],
});

const UsersTableFilter = atom<string>({
  key: 'UsersTableFilter',
  default: '',
});

const UsersTablePage = atom<number>({
  key: 'UsersTablePage',
  default: 1,
});

const UsersTableLastPage = atom<number>({
  key: 'UsersTableLastPage',
  default: 0,
});

export const UsersTable = (): JSX.Element => {
  const allAdminUsers = useRecoilValue(AllAdminUsers);
  const allForwarderUsers = useRecoilValue(AllForwarderUsers);
  const allQuantifierUsers = useRecoilValue(AllQuantifierUsers);
  const allUsers = useRecoilValue(AllUsers);

  const [tableData, setTableData] = useRecoilState(UsersTableData);
  const [selectedRole, setSelectedRole] = useRecoilState(
    UsersTableSelectedRole
  );
  const [filter, setFilter] = useRecoilState(UsersTableFilter);
  const [page, setPage] = useRecoilState(UsersTablePage);
  const [lastPage, setLastPage] = useRecoilState(UsersTableLastPage);

  const applyFilter = React.useCallback(
    (data: User[] | undefined): User[] => {
      if (!data) return [];
      const filteredData = data.filter((user: User) => {
        const userAddress = user.identityEthAddress?.toLowerCase();
        const filterData = filter.toLocaleLowerCase();

        return (
          user.username.toLowerCase().includes(filterData) ||
          userAddress?.includes(filterData)
        );
      });

      return filteredData;
    },

    [filter]
  );

  React.useEffect(() => {
    if (allUsers) {
      setTableData(allUsers);
    }
  }, [allUsers, setTableData]);

  React.useEffect(() => {
    switch (selectedRole.value) {
      case UserRole.USER:
        setTableData(allUsers);
        break;
      case UserRole.ADMIN:
        setTableData(allAdminUsers);
        break;
      case UserRole.FORWARDER:
        setTableData(allForwarderUsers);
        break;
      case UserRole.QUANTIFIER:
        setTableData(allQuantifierUsers);
        break;
    }
  }, [
    selectedRole,
    allUsers,
    allAdminUsers,
    allForwarderUsers,
    allQuantifierUsers,
    setTableData,
    setFilter,
  ]);

  React.useEffect(() => {
    if (tableData) {
      if (page > lastPage) {
        setPage(1);
      }

      const filteredData = applyFilter(tableData);

      if (filteredData.length % USERS_PER_PAGE === 0) {
        setLastPage(Math.trunc(filteredData.length / USERS_PER_PAGE));
      } else {
        setLastPage(Math.trunc(filteredData.length / USERS_PER_PAGE) + 1);
      }
    }
  }, [tableData, filter, applyFilter, setLastPage, page, lastPage, setPage]);

  return (
    <>
      <div className="flex flex-col gap-4 mx-5 mb-5 sm:flex-row">
        <SelectInput
          handleChange={setSelectedRole}
          selected={selectedRole}
          options={roleOptions}
        />
        <SearchInput
          handleChange={setFilter}
          value={filter}
          handleClear={(): void => setFilter('')}
        />
      </div>

      <div className="flex justify-between px-5 mb-2">
        <div className="w-1/2">
          <span className="font-bold">User</span>
        </div>
      </div>
      <React.Suspense fallback="Loading...">
        {applyFilter(tableData).map((row, index) => {
          if (Math.trunc(index / USERS_PER_PAGE) + 1 === page) {
            return <UsersTableRow key={row._id} data={row} />;
          }
        })}
        <UsersTablePagination
          lastPage={lastPage}
          page={page}
          setPage={setPage}
        />
      </React.Suspense>
    </>
  );
};
