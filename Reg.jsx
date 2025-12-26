// src/pages/Reg.jsx
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import DatePicker from '@components/form/DatePicker';
import TimePicker from '@components/form/TimePicker';
import Select from '@components/form/Select';
import Textarea from '@components/form/Textarea';
import Input from '@components/form/Input';
import Checkbox from '@components/form/Checkbox';
import { validateForm } from '@utils/formHandlers';
import FileManager from '@components/form/FileManager';
import { LabeledField } from '@components/common/LabeledField';
import { useFetch, useMutate } from '@hooks/useApi';
import { add, detail, modify } from '@api/commonApi';
import { useAuthStore } from '@store/authStore';
import selectiveForm from '@utils/selectiveForm';
import Button from '@components/ui/Button';
import { navigate } from '@routes/NavigationProvider';

export default function Reg({ paths }) {
  const { id } = useParams();
  const [fileInfo, setFileInfo] = useState();
  const [modalOpen, setModalOpen] = useState(false);
  const { username, userid } = useAuthStore();

  const { data } = useFetch(detail, { paths, id });
  const btnText = id ? '수정' : '등록';
  const fileRef = useRef(null);
  const [form, setForm] = useState({ authorName: username, authorId: userid });
  const { mAsync: createBoard, isLoading } = useMutate(add);
  const { mAsync: editBoard } = useMutate(modify);

  const isComplete = form?.status === 'COMPLETE';

  const validation = async () => {
    if (!validateForm()) return;
    if (form.noticeYn) {
      const state = fileRef.current?.getState();
      setFileInfo(state ? { ...state } : undefined);
      setModalOpen(true);
    } else handleSubmit();
  };

  const handleSubmit = async (file) => {
    const payload = file ? file : await fileRef.current?.fileUpload();
    const temp = selectiveForm(form, [{ include: isComplete, keys: [/^action/] }]);

    const params = {
      ...temp,
      ...payload,
    };

    const mutate = id ? editBoard : createBoard;
    await mutate({ paths, params });

    navigate('list');
  };

  useEffect(() => {
    data && setForm(data);
  }, [data]);

  const inputProps = (name, label) => ({
    id: name,
    name,
    value: form?.[name],
    form,
    setForm,
    placeholder: label,
    label,
    required: true,
    className: 'border rounded px-3 py-2 focus:ring-2 focus:ring-blue-400',
  });
  if (id && !form.status) return null;
  return (
    <div className="border px-6 py-6 max-w-7xl space-y-4 mx-auto bg-white shadow rounded">
      {/* 1행: 장애명 / 작성자 */}
      <div className="grid grid-cols-12 gap-4 items-center">
        <LabeledField
          props={inputProps('title', '장애명')}
          className="col-span-2"
          component={Input}
          compClassName={'col-span-4'}
        />
        <LabeledField
          props={{ ...inputProps('authorName', '작성자'), disabled: true }}
          className="col-span-2"
          component={Input}
          compClassName={'col-span-4'}
        />
      </div>

      {/* 2행: 시스템명 / 발생일자 / 시간 */}
      <div className="grid grid-cols-12 gap-4 items-center">
        <LabeledField
          props={inputProps('systemName', '시스템명')}
          className="col-span-2"
          component={Input}
          compClassName={'col-span-4'}
        />

        <LabeledField props={inputProps('occurDate', '발생일자')} className="col-span-2">
          <DatePicker {...inputProps('occurDate', '발생일자')} className={`${inputProps().className} col-span-2`} />
          <TimePicker {...inputProps('occurTime', '발생일자')} className={`${inputProps().className} col-span-2`} />
        </LabeledField>
      </div>

      {/* 3행: 상태 / 조치기한  */}
      <div className="grid grid-cols-12 gap-4 items-center">
        <LabeledField
          props={{
            ...inputProps('status', '상태'),
            options: [
              { label: '선택', value: '' },
              { label: '조치대기', value: 'WAIT' },
              { label: '조치중', value: 'ING' },
              { label: '완료', value: 'COMPLETE' },
            ],
            disabled: !data,
            defaultValue: data ? '' : 'WAIT',
          }}
          className="col-span-2"
          component={Select}
          compClassName={'col-span-4'}
        />

        <LabeledField props={inputProps('aaDate', '조치기한')} className="col-span-2">
          <DatePicker {...inputProps('aaDate', '조치기한')} className={`${inputProps().className} col-span-2`} />
        </LabeledField>
      </div>

      {/* 4행: 처리 담당자 / 조치 완료일자 시간 */}
      {
        <div className="grid grid-cols-12 items-center gap-2">
          <LabeledField props={{ ...inputProps('noticeYn', '처리 담당자'), disabled: !data }} className="col-span-2">
            <div className="col-span-3">
              {!data && <Button onClick={() => {}}>＠</Button>}
              <Input
                {...inputProps('noticeYn', '처리 담당자')}
                className={`${inputProps().className} col-span-2`}
                disabled={true}
              />
            </div>
          </LabeledField>

          {isComplete && (
            <LabeledField props={inputProps('actionDate', '조치완료일자')} className="col-span-3">
              <DatePicker
                {...inputProps('actionDate', '조치완료일자')}
                className={`${inputProps().className} col-span-2`}
              />
              <TimePicker
                {...inputProps('actionTime', '조치완료일자')}
                className={`${inputProps().className} col-span-2`}
              />
            </LabeledField>
          )}
        </div>
      }

      {/* 5행: 내용 */}
      <div className="grid grid-cols-12 gap-4">
        <LabeledField
          props={{ ...inputProps('content', '내용'), placeholder: '내용을 입력하세요' }}
          className="col-span-2"
          component={Textarea}
          compClassName={'col-span-10 h-[38vh] resize-y'}
        />
      </div>

      {/* 6행: 첨부파일 (선택) */}
      <div className="grid grid-cols-12 gap-4 items-center">
        <LabeledField
          props={{
            ...inputProps('fileGroupSequence', '첨부파일'),
            className: 'col-span-10',
            required: false,
            ref: fileRef,
            mode: 'All',
          }}
          className="pt-1 self-baseline col-span-2"
          component={FileManager}
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={validation}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded shadow"
        >
          {isLoading ? `${btnText} 중...` : btnText}
        </button>
        <button onClick={() => navigate('list')} className="bg-gray-300 hover:bg-gray-400 px-5 py-2 rounded shadow">
          목록
        </button>
      </div>
    </div>
  );
}
