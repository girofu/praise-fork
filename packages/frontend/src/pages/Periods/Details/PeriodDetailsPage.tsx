import BreadCrumb from '@/components/BreadCrumb';
import { HasRole, ROLE_ADMIN } from '@/model/auth';
import { SinglePeriod } from '@/model/periods';
import BackLink from '@/navigation/BackLink';
import PeriodDetailsComponent from '@/pages/Periods/Details/components/Details';
import { classNames } from '@/utils/index';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import 'react-day-picker/lib/style.css';
import { useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import PeriodNameForm from './components/PeriodNameForm';
import { QuantifierMessage } from './components/QuantifierMessage';
import QuantifierTable from './components/QuantifierTable';
import ReceiverTable from './components/ReceiverTable';

const PeriodDetailHead = () => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const { periodId } = useParams() as any;
  const isAdmin = useRecoilValue(HasRole(ROLE_ADMIN));
  const periodDetails = useRecoilValue(SinglePeriod(periodId));
  return (
    <>
      {' '}
      <div
        className={classNames(
          periodDetails?.status === 'OPEN'
            ? 'bg-green-300'
            : periodDetails?.status === 'QUANTIFY'
            ? 'bg-pink-300'
            : 'bg-gray-300',
          'float-right px-2 py-1 text-xs text-white rounded-full'
        )}
      >
        {periodDetails
          ? periodDetails.status === 'QUANTIFY'
            ? 'QUANTIFYING'
            : periodDetails.status
          : null}
      </div>
      {isAdmin ? <PeriodNameForm /> : <h2>{periodDetails?.name}</h2>}
      <PeriodDetailsComponent />
    </>
  );
};

const PeriodDetailPage = () => {
  return (
    <>
      <BreadCrumb name="Quantification periods" icon={faCalendarAlt} />
      <BackLink />

      <div className="w-2/3 praise-box ">
        <React.Suspense fallback="Loading…">
          <PeriodDetailHead />
        </React.Suspense>
      </div>

      <React.Suspense fallback="Loading…">
        <QuantifierMessage />
      </React.Suspense>

      <div className="w-2/3 praise-box">
        <React.Suspense fallback="Loading…">
          <QuantifierTable />
        </React.Suspense>
      </div>
      <div className="w-2/3 praise-box">
        <React.Suspense fallback="Loading…">
          <ReceiverTable />
        </React.Suspense>
      </div>
    </>
  );
};

export default PeriodDetailPage;
