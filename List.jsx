// src/pages/community/incident/List.jsx
import Button from '@components/ui/Button';
import ROUTES from '@routes/routes.generated';
import FilterBar from '@components/common/FilterBar';
import { useAuthStore } from '@store/authStore';
import { useState } from 'react';
import { navigate } from '@routes/NavigationProvider';
import Table from '@components/ui/table/Table';
import Select from '@components/form/Select';
import DatePicker from '@components/form/DatePicker';
import Input from '@components/form/Input';
import { useModalStore } from '@store/useModalStore';
import { LabeledField } from '@components/common/LabeledField';
import { clsx } from 'clsx';
import { list, remove } from '@api/commonApi';
import { useFetch, useMutate } from '@hooks/useApi';
import DetailPU from '@features/community/incident/DetailPU';

export default function List({ paths }) {
  const [form, setForm] = useState({});
  const [resetKey, setResetKey] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState({});
  const superAuthYn = useAuthStore((state) => state.superAuthYn);
  const modal = useModalStore();

  const pageRowCount = 15;

  const filterData = {
    keyword: form.keyword || '',
    title: form.title || '',
    status: form.status || '',
    occurStartDate: form.occurStartDate || '',
    occurEndDate: form.occurEndDate || '',
    sortKey: form.sortKey || 'occurAt',
    sortOrder: form.sortOrder || 'DESC',
    pageNo: 1,
    pageRowCount,
  };

  const [filter, setFilter] = useState(filterData);

  const { data } = useFetch(list, { paths, params: filter });
  const { mAsync: deleteBoard } = useMutate(remove);

  const columns = [
    { key: 'checkbox', label: '', width: 'w-8' },
    { key: 'occurAt', label: '발생일자', width: 'w-32', sortKey: 'occurAt', sortOrder: filter.sortOrder },
    { key: 'systemName', label: '시스템명', width: 'w-32' },
    { key: 'title', label: '제목', width: 'w-80' },
    { key: 'statusName', label: '상태', width: 'w-24' },
    { key: 'actionAt', label: '조치완료일시', width: 'w-32', sortKey: 'actionAt', sortOrder: filter.sortOrder },
    { key: 'authorName', label: '작성자', width: 'w-28' },
    { key: 'noticeYn', label: '공지', width: 'w-16' },
  ];

  async function handleRowClick(row) {
    navigate(`/detail/${row.id}`);
    //setSelected(row);
    //setModalOpen(true);
  }
  async function handleDelete(id) {
    await deleteBoard({ paths, ids: [id] });
    setModalOpen(false);
  }

  const handleCreate = () => {
    navigate('reg');
  };

  const onDeleteLists = async () => {
    let content = '삭제할 항목을 선택해주세요';
    let onConfirm;
    if (form.ids?.length) {
      content = `${form.ids.length}개 항목을\n삭제하시겠습니까?`;
      onConfirm = async () => {
        await deleteBoard({ paths, ids: form.ids });
      };
    }
    modal.open({ content, onConfirm });
  };

  const onPageChange = (obj) => {
    setFilter((prev) => ({ ...prev, ...obj }));
  };

  const inputProps = (name, label) => ({
    id: name,
    name,
    value: form[name],
    form,
    setForm,
    placeholder: label,
    resetKey,
    label,
    className: 'border rounded px-2 py-1 focus:ring-2 focus:ring-blue-400',
  });

  return (
    <div>
      <FilterBar
        onReset={() => setResetKey((k) => k + 1)}
        onSearch={() => setFilter(filterData)}
        onKeyDown={(e) => e.key === 'Enter' && setFilter(filterData)}
        top={
          <div className="grid grid-cols-9 gap-4 items-center mb-4">
            {/* <LabeledField
              props={{
                ...inputProps('systemName', '시스템명'),
                options: (items ?? []).reduce(
                  (acc, el) => {
                    if (!acc.some((item) => item.value === el.systemName)) {
                      acc.push({ label: el.systemName, value: el.systemName });
                    }
                    return acc;
                  },
                  [{ label: '전체', value: '' }]
                ),
              }}
              className="col-span-2"
              component={Select}
            /> */}
            <LabeledField
              props={{
                ...inputProps('keyword', '검색어'),
                placeholder: '시스템명/장애명',
              }}
              className="col-span-2"
              component={Input}
              compClassName={'col-span-2'}
            />
          </div>
        }
        bottom={
          <div className="grid grid-cols-9 gap-4 items-center">
            <LabeledField
              props={{
                ...inputProps('status', '상태'),
                options: [
                  { label: '전체', value: '' },
                  { label: '조치대기', value: 'WAIT' },
                  { label: '조치중', value: 'ING' },
                  { label: '완료', value: 'COMPLETE' },
                ],
              }}
              className="col-span-2"
              component={Select}
            />
            <LabeledField
              props={inputProps('occurStartDate', '발생일자')}
              className="col-span-2"
              children={
                <div className="col-span-2 flex items-center gap-1">
                  <DatePicker
                    {...inputProps('occurStartDate', '시작일자')}
                    max={form.occurEndDate}
                    className={clsx(inputProps().className, 'flex-1 min-w-0')}
                  />
                  <span className="select-none">~</span>
                  <DatePicker
                    {...inputProps('occurEndDate', '종료일자')}
                    min={form.occurStartDate}
                    className={clsx(inputProps().className, 'flex-1 min-w-0')}
                  />
                </div>
              }
            />
          </div>
        }
      />
      {/* 테이블 상단 버튼 */}
      <div className="bg-white p-2 rounded-lg shadow">
        <div className="flex justify-end mb-2 gap-2">
          {superAuthYn && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onDeleteLists}>
                삭제
              </Button>
              <Button onClick={handleCreate}>장애 등록</Button>
            </div>
          )}
        </div>
        <Table
          {...{
            columns,
            data,
            filter,
            inputProps,
            onRowClick: handleRowClick,
            onPageChange,
            pageRowCount,
          }}
        />
      </div>
      {modalOpen && <DetailPU {...{ paths, selected, setSelected, handleDelete, setModalOpen }} />}
    </div>
  );
}
