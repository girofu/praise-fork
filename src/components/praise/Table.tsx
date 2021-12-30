import { AllPraises } from "@/model/praise";
import { formatDate } from "@/utils/date";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { TableOptions, useTable } from "react-table";
import { useRecoilValue } from "recoil";
import PraisePageLoader from "./PraisePageLoader";

const PraisePageLoaderSpinner = () => {
  return (
    <div className="w-full mt-2 text-center">
      <FontAwesomeIcon
        icon={faSpinner}
        size="1x"
        spin
        className="inline-block mr-4"
      />
    </div>
  );
};

const PraisesTable = () => {
  const allPraises = useRecoilValue(AllPraises);
  const columns = React.useMemo(
    () => [
      {
        Header: "Id",
        accessor: "_id",
        Cell: (data: any) => {
          return data.value.substr(0, 4);
        },
      },
      {
        Header: "Date",
        accessor: "createdAt",
        Cell: (data: any) => {
          return formatDate(data.value);
        },
      },
      {
        Header: "From",
        accessor: "giver",
        Cell: (data: any) => {
          return `${data.value.username}`;
        },
      },
      {
        Header: "To",
        accessor: "receiver",
        Cell: (data: any) => {
          return `${data.value.username}`;
        },
      },
      {
        Header: "Praise",
        accessor: "reason",
      },
    ],
    []
  );

  const options = {
    columns,
    data: allPraises ? allPraises : [],
  } as TableOptions<{}>;
  const tableInstance = useTable(options);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    tableInstance;

  return (
    <>
      <React.Suspense fallback="Loading…">
        <table
          id="praises-table"
          className="w-full table-auto"
          {...getTableProps()}
        >
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => (
                  <th className="text-left" {...column.getHeaderProps()}>
                    {column.render("Header")}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row);
              return (
                <tr
                  className="cursor-pointer hover:bg-gray-100"
                  id={"praise-" + row.values.id}
                  {...row.getRowProps()}
                >
                  {row.cells.map((cell) => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render("Cell")}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </React.Suspense>
      <React.Suspense fallback={<PraisePageLoaderSpinner />}>
        <PraisePageLoader />
      </React.Suspense>
    </>
  );
};

export default PraisesTable;
