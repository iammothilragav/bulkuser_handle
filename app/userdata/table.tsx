"use client"

import { useEffect, useState, useMemo } from "react"
import { client } from "@/server/client"
import { InferResponseType } from "hono/client"
import { ColumnDef } from "@tanstack/react-table"
import { Trash2, UserPlus, FileSpreadsheet, Send, Upload } from "lucide-react"
import { read, utils } from "xlsx"
import { useRef } from "react"
import { DataTable } from "@/components/data-table" 
import { Button } from "@/components/ui/button" 


type User = InferResponseType<typeof client.api.users.$get>[0]

export default function UserTable() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [newUser, setNewUser] = useState<Partial<User>>({})
    const [formError, setFormError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [idsToDelete, setIdsToDelete] = useState<number[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    
    const columns: ColumnDef<User>[] = useMemo(() => [
        {
            id: "select",
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
                    aria-label="Select all"
                    className="translate-y-[2px]"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={(e) => row.toggleSelected(!!e.target.checked)}
                    aria-label="Select row"
                    className="translate-y-[2px]"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "serial",
            header: "ID", // Display sequential ID as requested
            cell: ({ row }) => row.index + 1,
        },
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "age",
            header: "Age",
        },
        {
            accessorKey: "birth",
            header: "Birth Date",
            cell: ({ row }) => {
                const dateStr = row.getValue("birth")
                if (typeof dateStr === 'string') return new Date(dateStr).toLocaleDateString()
                // @ts-ignore
                if (dateStr instanceof Date) return dateStr.toLocaleDateString()
                return String(dateStr)
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                return (
                    <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteClick([row.original.id!])}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )
            }
        }
    ], []) 

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await client.api.users.$get()
            if (!res.ok) throw new Error("Failed to fetch users")
            const data = await res.json()
            setUsers(data)
            setError(null)
        } catch (err) {
            console.error(err)
            setError("Failed to load users")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    // Delete Handlers
    const handleDeleteClick = (ids: number[]) => {
        setIdsToDelete(ids)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (idsToDelete.length === 0) return

        try {
            const res = await client.api.users.$delete({
                json: { ids: idsToDelete }
            })
            
            if (!res.ok) throw new Error("Failed to delete users")
            
            // Refresh data
            fetchUsers()
            setRowSelection({})
            setSuccessMessage(`Successfully deleted ${idsToDelete.length} users`)
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err) {
            console.error(err)
            setDeleteError("Failed to delete users")
            setTimeout(() => setDeleteError(null), 3000)
        } finally {
            setDeleteConfirmOpen(false)
            setIdsToDelete([])
        }
    }

    const handleDeleteSelected = () => {
        const selectedIndices = Object.keys(rowSelection)
        const selectedIds = selectedIndices
            .map(idx => users[parseInt(idx)]?.id)
            .filter(id => id !== undefined) as number[]
        
        if (selectedIds.length === 0) return
        handleDeleteClick(selectedIds)
    }

    // Create User Handler
    const handleCreateUser = async (e: React.FormEvent) => {

        e.preventDefault()
        setFormError(null)
        setSuccessMessage(null)
        if (!newUser.name || !newUser.age || !newUser.birth) {
             setFormError("All fields are required")
             return
        }

        try {
            const res = await client.api.users.$post({
                json: {
                    users: [{
                        id: 0,
                        name: newUser.name,
                        age: Number(newUser.age),
                        birth: String(newUser.birth) // Ensure string format
                    }]
                }
            })

            if (!res.ok) {
                 const errorData = await res.json()
                 // @ts-ignore
                throw new Error(errorData.message || "Failed to create user")
            }

            setNewUser({})
            setIsFormOpen(false)
            fetchUsers()
            setSuccessMessage("User created successfully")
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            console.error(err)
            setFormError(err.message || "Failed to create user")
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setSuccessMessage(null)
        setFormError(null)

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data = utils.sheet_to_json(ws)
                
                // Validate and format data
                // Expecting columns: name, age, birth
                const formattedUsers = data.map((row: any) => ({
                    id: 0,
                    name: row.name || row.Name,
                    age: Number(row.age || row.Age),
                    birth: row.birth || row.Birth || row["Birth Date"]
                })).filter(u => u.name && u.age && u.birth).map(u => ({
                    ...u,
                    birth: typeof u.birth === 'number' 
                        ? new Date((u.birth - (25567 + 1))*86400*1000).toISOString().split('T')[0] // Excel date serial to JS Date
                        : String(u.birth)
                }))

                 if (formattedUsers.length === 0) {
                    setFormError("No valid users found in file. Ensure columns are: name, age, birth")
                    return
                }

                const res = await client.api.users.$post({
                    json: { users: formattedUsers }
                })

                if (!res.ok) {
                    const errorData = await res.json()
                     // @ts-ignore
                    throw new Error(errorData.message || "Failed to import users")
                }
                
                fetchUsers()
                setFormError(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
                setSuccessMessage(`Successfully imported ${formattedUsers.length} users`)
                setTimeout(() => setSuccessMessage(null), 3000)
            } catch (err: any) {
                console.error(err)
                setFormError(err.message || "Failed to parse excel file")
            }
        }
        reader.readAsBinaryString(file)
    }

    if (loading && users.length === 0) return <div className="p-4 text-center">Loading users...</div>
    if (error) return <div className="p-4 text-center text-red-500">{error}</div>

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-black dark:text-black">Admin Panel</h1>
                <div className="flex gap-2">
                    <Button onClick={() => setIsFormOpen(!isFormOpen)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Import Excel
                        </Button>
                    </div>
                    {Object.keys(rowSelection).length > 0 && (
                        <Button variant="destructive" onClick={handleDeleteSelected}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({Object.keys(rowSelection).length})
                        </Button>
                    )}
                </div>
            </div>

            {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{successMessage}</span>
                </div>
            )}
            {deleteError && (
                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{deleteError}</span>
                </div>
            )}

            {/* Add User Form */}
            {isFormOpen && (
                <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800/50 space-y-4">
                    <h3 className="font-semibold">Add New User</h3>
                    <form onSubmit={handleCreateUser} className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Name</label>
                            <input 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={newUser.name || ""}
                                onChange={e => setNewUser({...newUser, name: e.target.value})}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Age</label>
                            <input 
                                type="number"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={newUser.age || ""}
                                onChange={e => setNewUser({...newUser, age: Number(e.target.value)})}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Birth Date</label>
                            <input 
                                type="date"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={newUser.birth ? String(newUser.birth) : ""}
                                onChange={e => setNewUser({...newUser, birth: e.target.value})}
                                required
                            />
                        </div>
                        <Button type="submit">Save</Button>
                    </form>
                    {formError && <p className="text-sm text-red-500">{formError}</p>}
                </div>
            )}


            
             {/* Delete Confirmation Modal */}
             {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full space-y-4">
                        <h3 className="text-lg font-semibold">Confirm Deletion</h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete {idsToDelete.length} users? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                                No, Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete}>
                                Yes, Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <DataTable 
                    columns={columns} 
                    data={users} 
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection} 
                />
            </div>
            
             <div className="text-sm text-gray-500">
                Total: {users.length} users
            </div>
        </div>
    )
}
