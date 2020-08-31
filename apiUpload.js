// inisiasi library
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const mysql = require('mysql')
const md5 = require('md5')
const moment = require('moment')
const Cryptr = require("cryptr")
const crypt = new Cryptr("1234567") // secret key, boleh diganti kok
const multer = require('multer') // untuk upload file
const path = require('path') // untuk memanggil path direktori
const fs = require('fs') // untuk manajemen file

// implementation
const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static(__dirname))
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.listen(8000, () => {
    console.log("Run on port 8000");
})

//connect mySql
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rent_car'
})

db.connect(error => {
    if (error) {
        console.log(error.message);
    } else {
        console.log("MySQL Connected");
    }
})

// Autentication
Token = () => {
    return (req, res, next) => {
        // cek keberadaan "Token" pada request header
        if (!req.get("Token")) {
            
            res.json({ 
                message: "Access Forbidden" // jika "Token" tidak ada
            })
        } else {

            // tampung nilai Token
            let token  = req.get("Token") 

            // decrypt token menjadi id_karyawan
            let decryptToken = crypt.decrypt(token)

            // sql cek id_karyawan
            let sql = "SELECT * FROM karyawan WHERE ?" 

            // set parameter
            let param = { id_karyawan: decryptToken} 
  
            // run query
            db.query(sql, param, (error, result) => {
                if (error) throw error
                 // cek keberadaan id_karyawan
                if (result.length > 0) {
                    next() // id_karyawan tersedia
                } else {
                    res.json({
                        message: "Invalid Token" // jika karyawan tidak tersedia
                    })
                }
            })
        }
  
    }
  }

// endpoint login karyawan (authentication)
app.post("/karyawan/auth", (req,res) => {
    // tampung username dan password
    let param = [
        req.body.username,
        md5(req.body.password)
    ]

    let sql = "SELECT * FROM karyawan WHERE username = ? AND password = ?"
    db.query(sql, param, (error, result) => {
        if (error) throw error 

       // cek jumlah data hasil query
        if (result.length > 0) {
            //user tersedia
            res.json({
                message: "Logged",
                token: crypt.encrypt(result[0].id_karyawan), // generate token
                data: result
            })
        } else {
            //user tak tersedia
            res.json({
                message: "Invalid username/password"
            })
        }
    })

})

//konfigurasi proses upload file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // set file storage
        cb(null, './image');
    },
    filename: (req, file, cb) => {
        // generate file name 
        cb(null, "image-"+ Date.now() + path.extname(file.originalname))
    }
})

let upload = multer({storage: storage})

// Mobil =========================================================================

// end-point akses data mobil => GET 
app.get("/mobil", Token(), (req,res) => {
    //create sql
    let sql = "SELECT * FROM mobil"

    //run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }
        } else {
            response = {
                count: result.length, // jumlah data
                mobil: result // isi data 
            }
        }
        res.json(response)
    })
})

// end-point akses data mobil berdasarkan id_mobil tertentu => GET
app.get("/mobil/:id", (req,res) => {
    let data = {
        id_mobil: req.params.id
    }

    //create sql
    let sql = "SELECT * FROM mobil WHERE ?"

    //run query
    db.query(sql, (error, result) => { //run query
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }
        } else {
            response = {
                count: result.length, // jumlah data
                mobil: result // isi data 
            }
        }
        res.json(response)
    })
})

// end-point menyimpan data mobil => POST
app.post("/mobil", upload.single("image"), (req,res) => {
    //prepare data
    let data = {
        nomor_mobil: req.body.nomor_mobil,
        merk: req.body.merk,
        jenis: req.body.jenis,
        warna: req.body.warna,
        tahun_pembuatan: req.body.tahun_pembuatan,
        biaya_sewa_per_hari: req.body.biaya_sewa_per_hari,
        image: req.file.filename
    }

    if (!req.file) {
        // jika tidak ada file yang diupload
        res.json({
            message: "Tidak ada file yang dikirim"
        })
    } else {
        // create sql insert
        let sql = "INSERT INTO mobil SET ?"

        // run query
        db.query(sql, data, (error, result) => {
            if(error) throw error
            res.json({
                message: result.affectedRows + " data inserted"
            })
        })
    }
})

// end-point mengubah data mobil => PUT
app.put("/mobil", upload.single("image"), (req,res) => {

    let data = null, sql = null
    // paramter perubahan data
    let param = { id_mobil: req.body.id_mobil }

    if (!req.file) {
        // jika tidak ada file yang dikirim = update data saja
        data = {
            nomor_mobil: req.body.nomor_mobil,
            merk: req.body.merk,
            jenis: req.body.jenis,
            warna: req.body.warna,
            tahun_pembuatan: req.body.tahun_pembuatan,
            biaya_sewa_per_hari: req.body.biaya_sewa_per_hari,
        }
    } else {
        // jika mengirim file = update data + reupload
        data = {
            nomor_mobil: req.body.nomor_mobil,
            merk: req.body.merk,
            jenis: req.body.jenis,
            warna: req.body.warna,
            tahun_pembuatan: req.body.tahun_pembuatan,
            biaya_sewa_per_hari: req.body.biaya_sewa_per_hari,
            image: req.file.filename
        }

        // get data yg akan diupdate utk mendapatkan nama file yang lama
        sql = "SELECT * FROM mobil WHERE ?"
        // run query
        db.query(sql, param, (err, result) => {
            if (err) throw err
            // tampung nama file yang lama
            let fileName = result[0].image

            // hapus file yg lama
            let dir = path.join(__dirname,"image",fileName)
            fs.unlink(dir, (error) => {})
        })

    }

    // create sql update
    sql = "UPDATE mobil SET ? WHERE ?"

    // run sql update
    db.query(sql, [data,param], (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data updated"
            })
        }
    })
})

// end-point menghapus data siswa berdasarkan id_mobil => DELETE
app.delete("/mobil/:id", (req,res) => {
    
    let param = { id_mobil: req.params.id }

    let sql = "SELECT * FROM mobil WHERE ?"
    db.query(sql, param, (error, result) => {
        if (error) throw error
        
        let fileName = result[0].image

        let dir = path.join(__dirname,"image",fileName)
        fs.unlink(dir, (error) => {})

    })

    let data = {
        id_mobil: req.params.id
    }

    sql = "DELETE FROM mobil WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data deleted"
            }
        }
        res.json(response)
    })
})

// Pelanggan =========================================================================

//endpoint akses pelanggan => GET
app.get("/pelanggan", (req,res) => {
    let sql = "SELECT * FROM pelanggan" //query

    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                pelanggan: result // isi data 
            }            
        }
        res.json(response)
    }) 
})

//endpoint akses data user berdasarkan id_pelanggan => GET
app.get("/pelanggan/:id", (req,res) => {
    let data = {
        id_pelanggan: req.params.id
    }

    let sql = "SELECT * FROM pelanggan WHERE ?"

    db.query(sql, (error, result) => { //run query
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }
        } else {
            response = {
                count: result.length, // jumlah data
                pelanggan: result // isi data 
            }
        }
        res.json(response)
    })
})

// end-point menyimpan data pelanggan => POST
app.post("/pelanggan", (req,res) => {
    let data = {
        nama_pelanggan: req.body.nama_pelanggan,
        alamat_pelanggan: req.body.alamat_pelanggan,
        kontak: req.body.kontak
    }

    let sql = "INSERT INTO pelanggan SET ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data inserted"
            }
        }
        res.json(response)
    })
})

// end-point mengubah data pelanggan => PUT
app.put("/pelanggan", (req,res) => {
    let data = [
        //data
        {
            nama_pelanggan: req.body.nama_pelanggan,
            alamat_pelanggan: req.body.alamat_pelanggan,
            kontak: req.body.kontak
        },
        //parameter (primary key)
        {
            id_pelanggan: req.body.id_pelanggan
        }
    ]

    let sql = "UPDATE pelanggan SET ? WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data updated"
            }
        }
        res.json(response)
    })
})

// end-point menghapus data user berdasarkan id_pelanggan => DELETE
app.delete("/pelanggan/:id", (req,res) => {
    let data = {
        id_pelanggan: req.params.id
    }

    let sql = "DELETE FROM pelanggan WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data deleted"
            }
        }
        res.json(response)
    })
})

// Karyawan =========================================================================

//endpoint akses karyawan => GET
app.get("/karyawan", (req,res) => {
    let sql = "SELECT * FROM karyawan" //query

    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                karyawan: result // isi data 
            }            
        }
        res.json(response)
    }) 
})

//endpoint akses data user berdasarkan id_karyawan => GET
app.get("/karyawan/:id", (req,res) => {
    let data = {
        id_karyawan: req.params.id
    }

    let sql = "SELECT * FROM karyawan WHERE ?"

    db.query(sql, (error, result) => { //run query
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }
        } else {
            response = {
                count: result.length, // jumlah data
                karyawan: result // isi data 
            }
        }
        res.json(response)
    })
})

// end-point menyimpan data karyawan => POST
app.post("/karyawan", (req,res) => {
    let data = {
        nama_karyawan: req.body.nama_karyawan,
        alamat_karyawan: req.body.alamat_karyawan,
        kontak: req.body.kontak,
        username: req.body.username,
        password: req.body.password
    }

    let sql = "INSERT INTO karyawan SET ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data inserted"
            }
        }
        res.json(response)
    })
})

// end-point mengubah data karyawan => PUT
app.put("/karyawan", (req,res) => {
    let data = [
        //data
        {
            nama_karyawan: req.body.nama_karyawan,
            alamat_karyawan: req.body.alamat_karyawan,
            kontak: req.body.kontak,
            username: req.body.username,
            password: req.body.password
        },
        //parameter (primary key)
        {
            id_karyawan: req.body.id_karyawan
        }
    ]

    let sql = "UPDATE karyawan SET ? WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data updated"
            }
        }
        res.json(response)
    })
})

// end-point menghapus data karyawan berdasarkan id_karyawan => DELETE
app.delete("/karyawan/:id", (req,res) => {
    let data = {
        id_karyawan: req.params.id
    }

    let sql = "DELETE FROM karyawan WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data deleted"
            }
        }
        res.json(response)
    })
})

// Sewa =========================================================================

//endpoint akses data sewa => GET
app.get("/sewa", (req,res) => {
    let sql = "SELECT * FROM sewa" //query

    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                sewa: result // isi data 
            }            
        }
        res.json(response)
    }) 
})

//endpoint akses data user berdasarkan id_sewa => GET
app.get("/sewa/:id", (req,res) => {
    let data = {
        id_sewa: req.params.id
    }

    let sql = "SELECT * FROM sewa WHERE ?"

    db.query(sql, (error, result) => { //run query
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }
        } else {
            response = {
                count: result.length, // jumlah data
                sewa: result // isi data 
            }
        }
        res.json(response)
    })
})

// end-point menyimpan data sewa => POST
app.post("/sewa", (req,res) => {
    let data = {
        id_mobil: req.body.id_mobil,
        id_karyawan: req.body.id_karyawan,
        id_pelanggan : req.body.id_pelanggan ,
        // waktu pada saat input
        tgl_sewa: moment().format('YYYY-MM-DD HH:mm:ss'),
        tgl_kembali: moment().format('YYYY-MM-DD HH:mm:ss'), 
        total_bayar: req.body.total_bayar
    }

    let sql = "INSERT INTO sewa SET ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data inserted"
            }
        }
        res.json(response)
    })
})

// end-point mengubah data sewa => PUT
app.put("/sewa", (req,res) => {
    let data = [
        //data
        {
            id_mobil: req.body.id_mobil,
            id_karyawan: req.body.id_karyawan,
            id_pelanggan : req.body.id_pelanggan ,
            // waktu pada saat input
            tgl_sewa: moment().format('YYYY-MM-DD HH:mm:ss'),
            tgl_kembali: moment().format('YYYY-MM-DD HH:mm:ss'), 
            total_bayar: req.body.total_bayar
        },
        //parameter (primary key)
        {
            id_sewa: req.body.id_sewa
        }
    ]

    let sql = "UPDATE sewa SET ? WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data updated"
            }
        }
        res.json(response)
    })
})

// end-point menghapus data siswa berdasarkan id_sewa => DELETE
app.delete("/sewa/:id", (req,res) => {
    let data = {
        id_sewa: req.params.id
    }

    let sql = "DELETE FROM sewa WHERE ?"
    db.query(sql, data, (error, result) => {
        let response = null 
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data deleted"
            }
        }
        res.json(response)
    })
})

// // end-point menambahkan data sewa => POST
// app.post("/sewa", (req,res) => {
//     let data = {
    // id_mobil: req.body.id_mobil,
    // id_karyawan: req.body.id_karyawan,
    // id_pelanggan : req.body.id_pelanggan ,
    // // waktu pada saat input
    // tgl_sewa: moment().format('YYYY-MM-DD HH:mm:ss'),
    // tgl_kembali: moment().format('YYYY-MM-DD HH:mm:ss'), 
    // total_bayar: req.body.total_bayar
//     }

//     let pelanggaran = JSON.parse(req.body.pelanggaran) // parse to JSON

//     let sql = "INSERT INTO sewa SET ?"
//     db.query(sql, data, (error, result) => {
//         let response = null

//         if (error) {
//             res.json({message: error.message})
//         } else {
//             let lastID = result.insertId

//             let data = []
//             for (let index = 0; index < pelanggaran.length; index++) {
//                 data.push([
//                     lastID, pelanggaran[index].id_pelanggaran
//                 ])
//             }

//             let sql = "INSERT INTO detail_sewa VALUES ?"
//             db.query(sql, [data], (error, result) => {
//                 if (error) {
//                     res.json({message: error.message})
//                 } else {
//                     res.json({message: "Data has been inserted"})
//                 }
//             })
//         }
//     })
// })



