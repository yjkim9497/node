import { add } from '@api/commonApi';
import Button from '@components/ui/Button';
import { LabeledField } from '@components/common/LabeledField';
import Checkbox from '@components/form/Checkbox';
import DatePicker from '@components/form/DatePicker';
import FileManager from '@components/form/FileManager';
import Input from '@components/form/Input';
import Textarea from '@components/form/Textarea';
import TimePicker from '@components/form/TimePicker';
import Modal from '@components/modal/Modal';
import { useMutate } from '@hooks/useApi';
import ROUTES from '@routes/routes.generated';
import { validateForm } from '@utils/formHandlers';
import selectiveForm from '@utils/selectiveForm';
import { useRef, useState } from 'react';
import { navigate } from '@routes/NavigationProvider';

const NoticePU = ({ paths, fileInfo, data, setModalOpen, handleSubmit }) => {
  const fileRef = useRef(null);

  const [form, setForm] = useState(data);
  const { mAsync: addBoard } = useMutate(add);

  const isReserved = form.reserveEnabled;

  const validation = () => {
    if (!validateForm()) return;
    sequentialPost();
  };

  const sequentialPost = async () => {
    const payload = await fileRef.current?.fileUpload();

    const { reserveEnabled } = form || {};
    const temp = selectiveForm(form, [{ include: isReserved, keys: [/^reserved/] }]);

    const params = {
      ...temp,
      ...payload,
      categoryType: 'notice',
      reserveEnabled: reserveEnabled ? 'Y' : 'N',
    };

    await addBoard({ paths: ['/community', '/notice', ''], params });

    await handleSubmit(payload);
    navigate('/list');
  };

  const inputProps = (name, label) => ({
    id: name,
    name,
    value: form[name],
    form,
    setForm,
    placeholder: label,
    label,
    required: true,
    className: 'border rounded px-3 py-2 focus:ring-2 focus:ring-blue-400',
    tableId: 'COMMUNITY_IR_TABLE',
    columnId: 'FILE_GROUP_SEQUENCE',
  });

  return (
    <Modal
      visible={true}
      size="lg"
      onClose={() => setModalOpen(false)}
      header="공지사항 등록"
      body={
        <div className="space-y-4 max-w-7xl mx-auto bg-white shadow rounded">
          {/* 제목  */}
          <div className="grid grid-cols-12 gap-4 items-center">
            <LabeledField
              props={inputProps('title', '제목')}
              className="col-span-2"
              component={Input}
              compClassName={'col-span-10'}
            />
          </div>
          {/* 작성자 */}
          <div className="grid grid-cols-12 gap-4 items-center">
            <LabeledField
              props={{ ...inputProps('authorName', '작성자'), disabled: true }}
              className="col-span-2"
              component={Input}
              compClassName={'col-span-6'}
            />
          </div>

          {/* 공지 설정 */}
          <div className="grid grid-cols-12 items-center gap-2">
            <LabeledField props={{ ...inputProps('privateYn', '공지 설정'), required: false }} className="col-span-2" />
            <div className="flex col-span-5 gap-2 justify-around flex-row-reverse">
              <div className="flex flex-row-reverse gap-2">
                <LabeledField
                  props={{ ...inputProps('reserveEnabled', '예약 설정'), required: false }}
                  className=" ml-0"
                  component={Checkbox}
                />
              </div>
              <div className="flex flex-row-reverse gap-2">
                <LabeledField
                  props={{ ...inputProps('importantYn', '중요 공지'), required: false }}
                  className=" ml-0"
                  component={Checkbox}
                />
              </div>
              <div className="flex flex-row-reverse gap-2">
                <LabeledField
                  props={{ ...inputProps('privateYn', '비공개'), required: false }}
                  className=" ml-0"
                  component={Checkbox}
                />
              </div>
            </div>
            {isReserved && (
              <>
                <DatePicker
                  {...inputProps('reservedDate', '예약일자')}
                  className={`${inputProps().className} col-span-2`}
                />
                <TimePicker
                  {...inputProps('reservedTime', '예약일자')}
                  className={`${inputProps().className} col-span-2`}
                />
              </>
            )}
          </div>

          {/* 내용 */}
          <div className="grid grid-cols-12 gap-4">
            <LabeledField
              props={{ ...inputProps('content', '내용'), placeholder: '내용을 입력하세요' }}
              className="col-span-2"
              component={Textarea}
              compClassName={'col-span-10 h-[38vh] resize-y'}
            />
          </div>

          {/* 첨부파일 (선택) */}
          <div className="grid grid-cols-12 gap-4 items-center">
            <LabeledField
              props={{
                ...inputProps('fileGroupSequence', '첨부파일'),
                className: 'col-span-10',
                required: false,
                ref: fileRef,
                init: fileInfo,
                mode: 'append',
              }}
              className="pt-1 self-baseline col-span-2"
              component={FileManager}
            />
          </div>
        </div>
      }
      footer={
        <>
          <Button children={'확인'} onClick={validation} />
          <Button children={'취소'} variant="secondary" onClick={() => setModalOpen(false)} />
        </>
      }
    />
  );
};

export default NoticePU;
