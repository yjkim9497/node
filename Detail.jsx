import { detail, remove } from '@api/commonApi';
import Button from '@components/ui/Button';
import FileManager from '@components/form/FileManager';
import GridTable from '@components/ui/GridTable';
import NoticePU from '@features/community/incident/NoticePU';
import { useFetch, useMutate } from '@hooks/useApi';
import { useAuthStore } from '@store/authStore';
import { statusReverseMap } from '@utils/communityMapper';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { navigate } from '@routes/NavigationProvider';

const Detail = ({ paths }) => {
  const { username, userid } = useAuthStore();
  const [form, setForm] = useState({ authorName: username, authorId: userid });

  const [modalOpen, setModalOpen] = useState(false);
  const { id } = useParams();
  const { data } = useFetch(detail, { paths, id });
  const { mAsync: deleteBoard } = useMutate(remove);

  async function handleDelete() {
    await deleteBoard({ paths, ids: [id] });
  }

  return (
    <div className="border px-6 py-6 max-w-7xl space-y-4 mx-auto bg-white shadow rounded">
      <GridTable
        data={data}
        rows={[
          { key: 'title', label: '장애명', colNum: 2 },
          { key: 'authorName', label: '작성자', colNum: 2 },
          { key: 'a1', label: '장애 ID' },
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
                {statusReverseMap[data?.status] || '-'}
              </span>
            ),
            // colNum: data?.actionAt ? 2 : 1,
            colNum: 2,
          },
          {
            key: 'aAt',
            label: '조치기한',
            colNum: 2,
          },
          {
            key: 'aaAt',
            label: '처리 담당자',
            colNum: 2,
          },
          {
            key: 'actionAt',
            label: '조치완료일자',
            // invisible: true,
            colNum: 2,
          },
          { key: 'content', label: '장애내용', class: 'p-2 whitespace-pre-line h-[25vh]' },
          {
            key: 'fileGroupSequence',
            label: '첨부',
            value: <FileManager form={data} setForm={() => {}} />,
            invisible: true,
          },
          {
            key: 'noticeYn',
            label: '공지사항 등록여부',
            // invisible: true,
          },
        ]}
        total={6}
        lSpan={1}
      />
      <div className="w-full flex justify-between mb-2 gap-2">
        <div className="flex">
          {data?.noticeYn === false && (
            <Button children={'공지사항으로 등록'} variant="ghost" onClick={() => setModalOpen(true)} />
          )}
        </div>
        <div className="flex space-x-2">
          <Button children={'삭제'} variant="secondary" onClick={() => handleDelete()} />
          <Button
            children={'수정'}
            onClick={() => {
              navigate(`edit/${id}`);
            }}
          />

          <Button children={'목록'} variant="secondary" onClick={() => navigate('list')} />
        </div>
      </div>
      {modalOpen ? <NoticePU {...{ paths, setModalOpen }} data={{ ...data, ...form }} /> : <></>}
    </div>
  );
};

export default Detail;
