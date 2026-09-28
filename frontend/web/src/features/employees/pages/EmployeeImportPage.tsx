import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import DescriptionIcon from '@mui/icons-material/Description';
import { PATHS } from '../../../routes/paths';
import {
  downloadImportTemplate,
  validateImportFile,
  executeImportFile,
} from '../../../services/employeeService';
import type { ValidationSummary, ImportExecutionResult } from '../../../types/employee';
import { ImportPreview } from '../components/ImportPreview';

type ImportStep = 'SELECT_FILE' | 'PREVIEW' | 'COMPLETED';

export default function EmployeeImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ImportStep>('SELECT_FILE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [provisionAccounts, setProvisionAccounts] = useState<boolean>(true);

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'employee_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download template. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setError('Please select a valid CSV file (.csv)');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    setIsValidating(true);
    setError(null);
    try {
      const summary = await validateImportFile(selectedFile);
      setValidationSummary(summary);
      setStep('PREVIEW');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File validation failed. Please check the format.';
      setError(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedFile) return;
    setIsExecuting(true);
    setError(null);
    try {
      const result = await executeImportFile(selectedFile, provisionAccounts);
      setExecutionResult(result);
      setStep('COMPLETED');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import execution failed. Please try again.';
      setError(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationSummary(null);
    setExecutionResult(null);
    setError(null);
    setStep('SELECT_FILE');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(PATHS.employees)}
            sx={{ color: 'text.secondary' }}
          >
            Back to Employees
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Bulk Employee Import
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          sx={{ fontWeight: 600 }}
        >
          Download CSV Template
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 1: Select File */}
      {step === 'SELECT_FILE' && (
        <Card variant="outlined" sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
          <CardContent>
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.8 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              Upload Employee CSV File
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
              Upload your employee list. Our engine matches records by Employee Code and Official Email.
              New employees will be created and existing employees will be updated.
            </Typography>

            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                onClick={() => fileInputRef.current?.click()}
                startIcon={<DescriptionIcon />}
                size="large"
              >
                Choose CSV File
              </Button>
            </Box>

            {selectedFile && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  px: 3,
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  mb: 3,
                }}
              >
                <DescriptionIcon color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                disabled={!selectedFile || isValidating}
                onClick={handleValidate}
                startIcon={isValidating ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ minWidth: 200 }}
              >
                {isValidating ? 'Validating File...' : 'Validate & Preview'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview & Confirm */}
      {step === 'PREVIEW' && validationSummary && (
        <Box>
          <ImportPreview summary={validationSummary} />

          <Card variant="outlined" sx={{ mt: 3, p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { sm: 'center' },
                gap: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={provisionAccounts}
                    onChange={(e) => setProvisionAccounts(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Auto-provision login accounts and dispatch credentials
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Generates secure temporary passwords and sends them to each employee's personal email
                    </Typography>
                  </Box>
                }
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={handleReset} disabled={isExecuting}>
                  Choose Another File
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={
                    isExecuting ||
                    (validationSummary.validNewCount === 0 && validationSummary.validUpdateCount === 0)
                  }
                  onClick={handleExecute}
                  startIcon={isExecuting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                  sx={{ minWidth: 180 }}
                >
                  {isExecuting ? 'Importing...' : 'Execute Import'}
                </Button>
              </Box>
            </Box>
          </Card>
        </Box>
      )}

      {/* Step 3: Completed Report */}
      {step === 'COMPLETED' && executionResult && (
        <Box>
          <Alert severity="success" sx={{ mb: 3 }}>
            <strong>Import Completed!</strong> Successfully processed {executionResult.totalRows} row(s).
          </Alert>

          {/* Results Summary Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            <Card variant="outlined" sx={{ borderLeft: '4px solid #16a34a' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                  CREATED
                </Typography>
                <Typography variant="h5" color="success.main" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {executionResult.created}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderLeft: '4px solid #2563eb' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                  UPDATED
                </Typography>
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {executionResult.updated}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderLeft: '4px solid #d97706' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  SKIPPED
                </Typography>
                <Typography variant="h5" color="warning.main" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {executionResult.skipped}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderLeft: '4px solid #dc2626' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                  FAILED
                </Typography>
                <Typography variant="h5" color="error.main" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {executionResult.failed}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Results Table */}
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Import Row Execution Details
              </Typography>
            </Box>

            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 60 }}>Row</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Employee Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Official Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {executionResult.results.map((res) => {
                    const color =
                      res.status === 'CREATED'
                        ? 'success'
                        : res.status === 'UPDATED'
                        ? 'info'
                        : res.status === 'SKIPPED'
                        ? 'warning'
                        : 'error';

                    return (
                      <TableRow key={res.rowNumber} hover>
                        <TableCell>{res.rowNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {res.employeeCode}
                        </TableCell>
                        <TableCell>{res.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={res.status}
                            color={color}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: res.message ? 'text.secondary' : 'text.disabled' }}>
                          {res.message || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="outlined" startIcon={<ReplayIcon />} onClick={handleReset}>
              Import Another File
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(PATHS.employees)}
              sx={{ fontWeight: 600 }}
            >
              View Employee Directory
            </Button>
          </Box>
        </Box>
      )}
    </Container>
  );
}
