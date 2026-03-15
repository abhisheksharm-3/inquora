import { TypeUploadModalSuccessProps } from "@/types/upload";
import { Upload, X } from "lucide-react";

/**
 * A presentational component that indicates a file has been successfully selected or staged for upload.
 *
 * It displays the name of the selected file along with an icon and provides a button
 * to remove the file, triggering a callback function.
 *
 * @component
 * @param {TypeUploadModalSuccessProps} props - The properties for the component.
 * @param {string} props.fileName - The name of the file to be displayed.
 * @param {() => void} props.handleRemoveFile - The callback function to execute when the remove button is clicked.
 * @returns {JSX.Element} The rendered success state component.
 */
const UploadModalSuccess: React.FC<TypeUploadModalSuccessProps> = ({
  fileName,
  handleRemoveFile,
}) => {
  return (
    <div className="border border-dashed border-[#333] rounded-lg p-6 text-center mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center mr-2">
            <Upload size={16} className="text-primary" />
          </div>
          <span className="text-sm">{fileName}</span>
        </div>
        <button
          className="text-primary hover:text-primary/90 cursor-pointer"
          onClick={handleRemoveFile}
          aria-label="Remove file"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default UploadModalSuccess;
