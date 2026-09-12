param([Parameter(Mandatory=$true)][string]$TargetDirectory)
$ErrorActionPreference = 'Stop'
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetDirectory)
if (-not (Test-Path -LiteralPath $resolvedTarget -PathType Container)) { throw 'Diretorio inexistente.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$directory = New-Object System.IO.DirectoryInfo($resolvedTarget)
$acl = $directory.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $false)
foreach ($existingRule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($existingRule) }
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.AddAccessRule($rule)
$directory.SetAccessControl($acl)
