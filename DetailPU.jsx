import { detail, modify } from '@api/commonApi';
import Button from '@components/ui/Button';
import FileManager from '@components/form/FileManager';
import Modal from '@components/modal/Modal';
import GridTable from '@components/ui/GridTable';
import { useFetch, useMutate } from '@hooks/useApi';
import ROUTES from '@routes/routes.generated';
import { useAuthStore } from '@store/authStore';
import { statusReverseMap } from '@utils/communityMapper';
import { navigate } from '@routes/NavigationProvider';

const DetailPU = ({ paths, selected, setSelected, handleDelete, setModalOpen }) => {
  const superAuthYn = useAuthStore((state) => state.superAuthYn);

  const { data: details } = useFetch(detail, { paths, id: selected?.id });
  const { mAsync: modifyBoard } = useMutate(modify);

  async function handleUpdate(noticeYn) {
    const params = { ...(details || {}), noticeYn };
    await modifyBoard({ paths, params });
    setModalOpen(false);
  }

  return (
    <Modal
      visible={selected.id}
      size="lg"
      onClose={() => setSelected({})}
      header="상세내용"
      body={
        <div className="space-y-4 overflow-y-auto max-h-[50vh] overflow-hidden">
          <GridTable
            data={details}
            rows={[
              { key: 'title', label: '장애명', colNum: 2 },
              { key: 'authorName', label: '작성자', colNum: 2 },
              { key: 'systemName', label: '시스템명', colNum: 2 },
              {
                key: 'createdAt',
                label: '발생일자',
                colNum: 2,
              },
              {
                key: 'status',
                label: '상태',
                value: (
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm">
                    {statusReverseMap[details?.status] || '-'}
                  </span>
                ),
                colNum: details?.actionAt ? 2 : 1,
              },
              {
                key: 'actionAt',
                label: '조치완료일자',
                invisible: true,
                colNum: 2,
              },
              { key: 'content', label: '장애내용', class: 'whitespace-pre-line h-[25vh]' },
              {
                key: 'fileGroupSequence',
                label: '첨부',
                value: <FileManager form={details} setForm={() => {}} />,
                invisible: true,
              },
            ]}
            total={6}
            lSpan={1}
          />
        </div>
      }
      footer={
        <div className="w-full flex justify-between mb-2 gap-2">
          <div className="flex">
            <Button children={'공지사항으로 등록'} variant="ghost" onClick={() => handleUpdate('N')} />
          </div>
          <div className="flex ">
            <Button children={'삭제'} variant="secondary" onClick={() => handleDelete(details?.id)} />
            <Button
              children={'수정'}
              onClick={() => navigate(`${ROUTES.COMMUNITY_INCIDENT_EDIT.url}`, { state: details })}
            />

            <Button children={'닫기'} variant="secondary" onClick={() => setModalOpen(false)} />
          </div>
        </div>
      }
    />
  );
};

export default DetailPU;
